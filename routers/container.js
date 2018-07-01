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

module.exports.router = router
