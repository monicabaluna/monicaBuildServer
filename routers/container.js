'use strict'
const amqp = require('amqp')
const amqp_stream = require('amqp-stream')
const express = require('express')
const HttpStatus = require('http-status-codes')

const router = express.Router()

router.post('/build', async function ({ body: message }, res) {
  try {
    let connection = amqp.createConnection()
    amqp_stream(
      {
        connection: connection,
        exchange: 'rpc',
        routingKey: 'upper'
      },
      function (err, rpc_stream) {
        rpc_stream.createCorrelatedRequest(function (err, upper) {
          if (err === 'undefined') {
            console.error('RabbitMQ error')
            connection.end.bind(connection)
          }
          upper.on('data', function (buf) {
            console.log(buf.toString())
          })
          upper.on('end', function () {
            console.log('done')
            connection.end.bind(connection)
          })
          upper.on('err', function () {
            console.error('RabbitMQ error')
            connection.end.bind(connection)
          })

          console.log('sending')
          upper.write(JSON.stringify(message))
        })
      }
    )
    res.sendStatus(HttpStatus.OK)
  } catch (err) {
    console.error(err)
    res.sendStatus(HttpStatus.OK)
  }
})

module.exports = function (io) {
  // Socket.IO
  let socket = io.of('api/v1/containers/build')
  socket.on('connection', function (clientSocket) {
    // Whenever someone disconnects this piece of code executed
    clientSocket.on('disconnect', function () {
      console.log('A user disconnected')
    })

    // Send a message after a timeout of 4seconds
    setTimeout(function () {
      clientSocket.send('Sent a message 4seconds after connection!')
    }, 4000)
  })
  return router
}
