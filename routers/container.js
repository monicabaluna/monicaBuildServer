'use strict'
const amqp = require('amqplib')
const express = require('express')
const HttpStatus = require('http-status-codes')

const router = express.Router()

const clientUidToSocket = {}

router.post('/build', async function ({ body: message }, res) {
  try {
    await assignTaskToWorker(message)
  } catch (err) {
    console.error(err)
  }

  res.sendStatus(HttpStatus.OK)
})

async function assignTaskToWorker (message) {
  let { _, clientUid } = message

  // start a connection and a channel to rabbit queue
  let connection = await amqp.connect('amqp://localhost')
  let channel = await connection.createChannel()

  // make sure needed queue exists (create it if it does not)
  let q = await channel.assertQueue('', { exclusive: true })

  // set handler for RPC responses
  channel.consume(q.queue, handleResponse(connection, clientUid), {
    noAck: true
  })

  // send build request
  channel.sendToQueue('build_rpc_queue', new Buffer(JSON.stringify(message)), {
    correlationId: clientUid,
    replyTo: q.queue
  })
}

const handleResponse = (connection, clientUid) => async response => {
  if (response.properties.correlationId != clientUid) {
    return
  }
  console.log(' [.] Got %s', response.content.toString())

  // forward response to client via socket io
  if (clientUidToSocket[clientUid]) {
    clientUidToSocket[clientUid].send(response.content.toString())
  }

  // verify if it's the final message
  if (
    response.content.toString() === 'PUSH_OK' ||
    response.content.toString().substring(0, 5) == 'ERROR'
  ) {
    console.log('done')

    // close rabbitmq connection
    await connection.close()

    // close connection to client
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
