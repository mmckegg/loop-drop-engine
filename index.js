var Bopper = require('bopper')
var Through = require('through')

var Ditty = require('ditty')
var MidiLooper = require('midi-looper')
var Soundbank = require('soundbank')

///////////////////////////////////////////////////////////////

module.exports = function(audioContext){
  var clock = Bopper(audioContext)

  var instances = {}
  var streams = []

  return {

    getClock: function(){
      return clock
    },

    getInstance: function(name){
      return instances[name] || null
    },

    createInstance: function(name){



      var instance = Soundbank(audioContext)
      var ditty = Ditty(clock)

      instance.looper = MidiLooper(clock.getCurrentPosition)
      instance.name = name

      // feedback loop
      ditty.pipe(instance).pipe(instance.looper).pipe(ditty)

      // connect to output
      instance.connect(audioContext.destination)

      // stream to interfaces
      streams.forEach(function(stream){
        connectInstance(instance, stream)
      })

      instances[name] = instance


      return instance
    },

    connect: function(stream){

      var clockStream = Plex(stream, 'clock')
      clock.pipe(clockStream)

      streams.push(stream)

      Object.keys(instances).forEach(function(key){
        var instance = instances[key]
        connectInstance(instance, stream)

      })
    }

  }
}

function Plex(stream, channel){
  var result = Through(function(data){
    stream.write(JSON.stringify({channel: result.channel, data: data}))
  })
  result.channel = channel
  stream.on('data', function(data){
    var object = null

    try {
      object = JSON.parse(data)
    } catch (ex){}

    if (object && object.channel == result.channel){
      result.queue(object.data)
    }
  })
  return result
}

function connectInstance(instance, stream){

  var playbackStream = Plex(stream, 'playback[' + instance.name + ']')
  var changeStream = Plex(stream, 'soundbank[' + instance.name + ']')

  instance.pipe(playbackStream)
  changeStream.pipe(instance.getChangeStream()).pipe(changeStream)
}