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


@app.route('/go', methods=('POST',))
def go():
  return flask.render_template('go.html',
    group_num=request.form['group'],
    num_groups=request.form['num_groups'],
    max_num=request.form['max_num'],
    user=request.form['user'],
    ignore_levels=request.form.get('ignore_levels') == 'on',
  )


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


if __name__ == '__main__':
  app.run()
