'use strict'
const amqp = require('amqplib')
const express = require('express')
const HttpStatus = require('http-status-codes')
const uuid = require('uuid/v1')

const router = express.Router()

const tokenToSocket = {}

router.post('/build', async function ({ body: message }, res) {
  let { clientToken } = message

  try {
    let connection = await amqp.connect('amqp://localhost')
    let channel = await connection.createChannel()

    let q = await channel.assertQueue('', { exclusive: true })
    let corr = uuid()

    console.log(corr)

    channel.consume(
      q.queue,
      function (msg) {
        if (msg.properties.correlationId == corr) {
          console.log(' [.] Got %s', msg.content.toString())
          if (tokenToSocket[clientToken]) {
            tokenToSocket[clientToken].send(msg.content.toString())
          }

          if (msg.content.toString() === 'PUSH_OK') {
            console.log('done')
            setTimeout(function () {
              connection.close()
            }, 500)
            if (tokenToSocket[clientToken]) {
              tokenToSocket[clientToken].disconnect()
              delete tokenToSocket[clientToken]
            }
          }
        }
      },
      { noAck: true }
    )

    channel.sendToQueue(
      'build_rpc_queue',
      new Buffer(JSON.stringify(message)),
      {
        correlationId: corr,
        replyTo: q.queue
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
      console.log(`Client disconnected.`)
      delete tokenToSocket[clientToken]
    })
  })

  return router
}
