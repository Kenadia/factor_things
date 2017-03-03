import flask
from flask import request
import flask_pymongo

app = flask.Flask(__name__, static_url_path='')
mongo = flask_pymongo.PyMongo(app)


@app.route('/', methods=('GET',))
def index():
  return flask.render_template('index.html')
  # return flask.render_template('index.html', votes=db['votes'])


if __name__ == '__main__':
  app.run()


# @app.route('/votes', methods=('POST', 'GET'))
# def votes(name=None):
#   if request.method == 'GET':
#     # return mongo.db.voteCount.find_one_or_404({})
#     return flask.jsonify({'votes': db['votes']})

#   elif request.method == 'POST':
#     # mongo.db.voteCount.update({}, {'$inc': {'count':1}})
#     db['votes'] += 1
#     return flask.jsonify({})
