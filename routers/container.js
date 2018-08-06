'use strict'
const amqp = require('amqplib')
const express = require('express')
const HttpStatus = require('http-status-codes')

const router = express.Router()

const tokenToSocket = {}

router.post('/build', async function ({ body: message }, res) {
  let { _, clientUid } = message

  try {
    let connection = await amqp.connect('amqp://localhost')
    let channel = await connection.createChannel()

    let q = await channel.assertQueue('', { exclusive: true })

    channel.consume(
      q.queue,
      function (msg) {
        if (msg.properties.correlationId == clientUid) {
          console.log(' [.] Got %s', msg.content.toString())
          if (tokenToSocket[clientUid]) {
            tokenToSocket[clientUid].send(msg.content.toString())
          }

          if (msg.content.toString() === 'PUSH_OK') {
            console.log('done')
            setTimeout(function () {
              connection.close()
            }, 500)
            if (tokenToSocket[clientUid]) {
              tokenToSocket[clientUid].disconnect()
              delete tokenToSocket[clientUid]
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
        correlationId: clientUid,
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
    let { _, clientUid } = clientSocket.handshake.query

    tokenToSocket[clientUid] = clientSocket

    clientSocket.on('disconnect', function () {
      console.log(`Client disconnected.`)
      delete tokenToSocket[clientUid]
    })
  })

  return router
}
