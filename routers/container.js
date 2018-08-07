'use strict'
const amqp = require('amqplib')
const express = require('express')
const HttpStatus = require('http-status-codes')

const router = express.Router()

const clientUidToSocket = {}

router.post('/build', async function ({ body: message }, res) {
  let { _, clientUid } = message

  try {
    let connection = await amqp.connect('amqp://localhost')
    let channel = await connection.createChannel()

    let q = await channel.assertQueue('', { exclusive: true })

    channel.consume(q.queue, handleResponse(connection, clientUid), {
      noAck: true
    })

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

const handleResponse = (connection, clientUid) => async msg => {
  if (msg.properties.correlationId != clientUid) {
    return
  }
  console.log(' [.] Got %s', msg.content.toString())

  if (clientUidToSocket[clientUid]) {
    clientUidToSocket[clientUid].send(msg.content.toString())
  }

  if (
    msg.content.toString() === 'PUSH_OK' ||
    msg.content.toString().substring(0, 5) == 'ERROR'
  ) {
    console.log('done')

    await connection.close()

    if (clientUidToSocket[clientUid]) {
      clientUidToSocket[clientUid].disconnect()
      delete clientUidToSocket[clientUid]
    }
  }
}

module.exports = function (io) {
  const socket = io.of('api/v1/containers/build')

  socket.on('connection', function (clientSocket) {
    let { _, clientUid } = clientSocket.handshake.query

    clientUidToSocket[clientUid] = clientSocket

    clientSocket.on('disconnect', function () {
      console.log(`Client disconnected.`)
      delete clientUidToSocket[clientUid]
    })
  })

  return router
}
