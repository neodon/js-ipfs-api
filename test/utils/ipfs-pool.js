const until = require('async/until')
const setImmediate = require('async/setImmediate')
const EventEmitter = require('events')

class Pool extends EventEmitter {
  constructor (create, options) {
    super()
    this._options = options || {}
    this._options.max = this._options.max || 25
    this._create = create
    this._resources = []
    this._queue = []
    this._state = Pool.STOPPED
    this._onStop = null
  }

  start () {
    this._state = Pool.STARTED

    until(
      () => this._state === Pool.STOPPED, // Stop creating resources if we stopped
      (cb) => {
        // If we've created or are creating more than `max` resources then
        // check again in the next tick
        if (this._resources.length >= this._options.max) {
          // console.log('MAX RESOURCES REACHED')
          return setTimeout(cb)
        }

        let resource = {}

        // If there is someone waiting on a resource, assign it to them
        if (this._queue.length) {
          // console.log('POOL CREATING NEW RESOURCE FOR WAITING CONSUMER')
          resource.owner = this._queue.shift()
        } else {
          // console.log('POOL CREATING NEW RESOURCE')
        }

        this._resources = this._resources.concat(resource)

        this._create((err, item) => {
          if (err) {
            if (resource.owner) {
              // Tell the owner that an error occurred when creating the resouce
              resource.owner(err)
            } else {
              // Tell whoever cares that an error occurred
              this.emit('error', err)
            }

            // Remove the errored resource from our pool
            this._resources = this._resources.filter(r => r !== resource)
            return setTimeout(cb)
          }

          // If this resource has an owner, give it to them
          if (resource.owner) {
            this._resources = this._resources.filter(r => r !== resource)
            resource.owner(null, item)
            return cb()
          }

          // Add the item to the resource object so that the next aquire can
          // take it immediately
          resource.item = item
          cb()
        })
      },
      (err) => {
        if (this._onStop) {
          this._onStop(err)
          this._onStop = null
          return
        }

        if (err) this.emit('error', err)
      }
    )
  }

  acquire (cb) {
    // Find a resource with an item but with no owner
    const resource = this._resources.find(r => r.item && !r.owner)

    // Nothing available, get in the queue
    if (!resource) {
      if (this._state !== Pool.STARTED) {
        return setImmediate(() => {
          cb(new Error(`Pool is ${this._state} and no resources are available`))
        })
      }

      // console.log('NO RESOURCES AVAILABLE, WAITING IN QUEUE')
      // console.log(this._resources.filter(r => r.owner).length, 'RESOURCES OWNED')
      // console.log(this._resources.filter(r => !r.item).length, 'RESOURCES CREATING')
      this._queue = this._queue.concat(cb)
      return
    }

    // console.log('PROVIDING POOLED RESOURCE')

    // Remove this resource from our pool and return the item
    this._resources = this._resources.filter(r => r !== resource)
    setImmediate(() => cb(null, resource.item))
  }

  stop (cb) {
    this._state = Pool.STOPPED
    this._onStop = cb
  }
}

Pool.STARTED = 'STARTED'
Pool.STOPPED = 'STOPPED'

module.exports = Pool
