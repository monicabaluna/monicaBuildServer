var bodyParser = require('body-parser')
var express = require('express')
var http = require('http')
var morgan = require('morgan')

var containerRouter = require('./routers/container.js')

var port = process.env.PORT || 3000
var app = express()

app.use(morgan('dev'))

var server = http.createServer(app)

var apiv1 = express.Router()

apiv1.use(bodyParser.json())
apiv1.use('/containers', containerRouter.router)

// api v1
app.use('/api/v1', apiv1)

app.use(function (err, req, res, next) {
  next
  console.error(err, 'Error')
})

server.listen(port, function (err) {
  if (err) {
    console.error('Server ' + err)
  } else {
    console.log('Server start port ' + port)
  }
})
