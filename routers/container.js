'use strict'
const express = require('express')
const HttpStatus = require('http-status-codes')

const router = express.Router()

router.post('/build', async function (
  { body: { source_url, branch, registry, username, password } },
  res
) {
  try {
    console.log('hello')
  } catch (err) {
    throw err
  }

  res.sendStatus(HttpStatus.OK)
})

module.exports.router = router
