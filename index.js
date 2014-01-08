var Bopper = require('bopper')
var Through = require('through')
var Plex = require('plexy')

var Ditty = require('ditty')
var MidiLooper = require('midi-looper')
var Soundbank = require('soundbank')

///////////////////////////////////////////////////////////////

module.exports = function(audioContext){
  var clock = Bopper(audioContext)

  var instances = {}
  var streams = []

  var commandHandlers = {
    'stop': function(){
      clock.stop()
    },
    'start': function(){
      clock.start()
    },
    'setTempo': function(command){
      clock.setTempo(command.value)
    }
  }

  return {

    getClock: function(){
      return clock
    },

    getInstance: function(name){
      return instances[name] || null
    },

    handleCommand: function(name, cb){
      commandHandlers[name] = cb
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

    getStream: function(){

      var stream = Through(function(data){
        stream.remote.queue(data)
      }, function(){
        stream.remote.queue(null)
      })

      stream.remote = Through(function(data){
        stream.queue(data)
      }, function(){
        stream.queue(null)
      })

      var clockStream = Plex(stream, 'clock')
      var beatStream = Plex(stream, 'beat')
      var commandStream = Plex(stream, 'commands')

      commandStream.on('data', function(data){
        if (commandHandlers[data.command]){
          commandHandlers[data.command](data)
        }
      })

      clock.pipe(clockStream)
      clock.on('beat', function(pos){
        beatStream.write(pos)
      })

      streams.push(stream)

      Object.keys(instances).forEach(function(key){
        var instance = instances[key]
        connectInstance(instance, stream)

      })

      return stream.remote
    }

  }
}

function connectInstance(instance, stream){

  var playbackStream = Plex(stream, 'playback[' + instance.name + ']')
  var changeStream = Plex(stream, 'soundbank[' + instance.name + ']')

  instance.pipe(playbackStream)
  changeStream.pipe(instance.getChangeStream()).pipe(changeStream)
}