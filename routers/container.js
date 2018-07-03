'use strict'
const amqp = require('amqp')
const amqp_stream = require('amqp-stream')
const express = require('express')
const HttpStatus = require('http-status-codes')

const router = express.Router()

const tokenToSocket = {}

router.post('/build', async function ({ body: message }, res) {
  let { clientToken } = message

  try {
    let connection = amqp.createConnection()
    amqp_stream(
      {
        connection,
        exchange: 'rpc',
        routingKey: 'upper'
      },
      function (err, rpc_stream) {
        if (err) {
          console.log('first err: ', err)
        }
        rpc_stream.createCorrelatedRequest(function (err, upper) {
          if (err) {
            console.log('Rabbit error:', err)
            if (tokenToSocket[clientToken]) {
              tokenToSocket[clientToken].disconnect()
              delete tokenToSocket[clientToken]
            }
            return connection.end.bind(connection)
          }

          upper.on('data', function (buf) {
            if (tokenToSocket[clientToken]) {
              tokenToSocket[clientToken].send(buf.toString())
            }
            console.log(buf.toString())
          })

          upper.on('end', function () {
            console.log('done')
            connection.end.bind(connection)
            if (tokenToSocket[clientToken]) {
              tokenToSocket[clientToken].disconnect()
              delete tokenToSocket[clientToken]
            }
          })
          upper.on('err', function () {
            console.error(err)
            connection.end.bind(connection)
            if (tokenToSocket[clientToken]) {
              tokenToSocket[clientToken].disconnect()
              delete tokenToSocket[clientToken]
            }
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
  const socket = io.of('api/v1/containers/build')

  socket.on('connection', function (clientSocket) {
    let { clientToken } = clientSocket.handshake.query

    tokenToSocket[clientToken] = clientSocket

    clientSocket.on('disconnect', function () {
      console.log(`Client(${clientToken}) disconnected.`)
      delete tokenToSocket[clientToken]
    })

    clientSocket.send(`I know your token: ${clientToken}`)
  })

  return router
}
