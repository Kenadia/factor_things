import datetime
import flask
from flask import request
import flask_pymongo

INITIAL_LEVEL = 1
MIN_LEVEL = 0
MAX_LEVEL = 10

app = flask.Flask(__name__, static_url_path='')
app.debug = True
mongo = flask_pymongo.PyMongo(app)


@app.route('/', methods=('GET',))
def index():
  return flask.render_template('index.html')


@app.route('/landing', methods=('GET', 'POST'))
def landing():
  # Optional GET params.
  max_num = ''
  num_groups = ''
  group = ''

  if request.method == 'GET':
    user = request.args.get('user')
    max_num = request.args.get('max_num', '')
    num_groups = request.args.get('num_groups', '')
    group = request.args.get('group', '')
  else:
    user = request.form['user']

  if not user:
    return flask.redirect('/', code=302)

  level_counts = {}
  for level in xrange(INITIAL_LEVEL + 1, MAX_LEVEL + 1):
    level_counts[level] = (
        mongo.db.levels.find({'user': user, 'level': level}).count())

  return flask.render_template('landing.html',
      level_counts=level_counts,
      user=user,
      max_num=max_num,
      num_groups=num_groups,
      group=group,
  )


@app.route('/go', methods=('GET', 'POST'))
def go():
  if request.method == 'GET':
    return flask.redirect('/', code=302)

  group = request.form['group']
  num_groups = request.form['num_groups']
  max_num = request.form['max_num']
  user = request.form['user']

  game_id = str(mongo.db.games.insert_one({
      'user': user,
      'max_num': max_num,
      'num_groups': num_groups,
      'group': group,
      'start_time': datetime.datetime.now(),
  }).inserted_id)

  return flask.render_template('go.html',
      user=user,
      max_num=max_num,
      num_groups=num_groups,
      group=group,
      ignore_levels=request.form.get('ignore_levels') == 'on',
      game_id=game_id,
  )


@app.route('/finish', methods=('POST',))
def finish():
  user = request.form['user']
  game_id = request.form['game_id']
  error_count = request.form['error_count']

  mongo.db.games.update({'_id': game_id}, {
      {'$set': {'end_time': datetime.datetime.now()}},
      {'$set': {'error_count': error_count}},
  })


@app.route('/levels', methods=('GET',))
def levels():
  user = request.args['user']
  max_num = int(request.args['max_num'])

  records = mongo.db.levels.find({'user': user, 'number': {'$lt': max_num}})

  data = {}

  for record in records:
    data[record['number']] = record['level']

  for i in xrange(1, max_num + 1):
    if i not in data:
      data[i] = INITIAL_LEVEL

  return flask.jsonify({'data': data})


@app.route('/up', methods=('POST',))
def up():
  user = request.form.get('user')
  number = int(request.form.get('number'))

  if user is None or number is None:
    return flask.jsonify({})

  # Increment level.

  record = mongo.db.levels.find_one({'user': user, 'number': number})

  if record is None:
    level = INITIAL_LEVEL + 1
    mongo.db.levels.insert_one({'user': user, 'number': number, 'level': level})
  else:
    level = record['level']
    if level < MAX_LEVEL:
      mongo.db.levels.update({'_id': record['_id']}, {'$inc': {'level': 1}})
  return flask.jsonify({})


@app.route('/down', methods=('POST',))
def down():
  user = request.form.get('user')
  number = int(request.form.get('number'))

  if user is None or number is None:
    return flask.jsonify({})

  # Cut level by half.

  record = mongo.db.levels.find_one({'user': user, 'number': number})

  if record is None:
    level = INITIAL_LEVEL - 1
    mongo.db.levels.insert_one({'user': user, 'number': number, 'level': level})
  else:
    level = record['level']
    if level > MIN_LEVEL:
      mongo.db.levels.update({'_id': record['_id']},
                             {'$set': {'level': level / 2}})
  return flask.jsonify({})


@app.route('/clear', methods=('POST',))
def clear():
  user = request.form['user']
  mongo.db.levels.remove({'user': user})
  return flask.redirect(flask.url_for('landing', user=user), code=302)


if __name__ == '__main__':
  app.run()
