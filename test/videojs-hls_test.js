(function(window, videojs, undefined) {
  /*
    ======== A Handy Little QUnit Reference ========
    http://api.qunitjs.com/

    Test methods:
    module(name, {[setup][ ,teardown]})
    test(name, callback)
    expect(numberOfAssertions)
    stop(increment)
    start(decrement)
    Test assertions:
    ok(value, [message])
    equal(actual, expected, [message])
    notEqual(actual, expected, [message])
    deepEqual(actual, expected, [message])
    notDeepEqual(actual, expected, [message])
    strictEqual(actual, expected, [message])
    notStrictEqual(actual, expected, [message])
    throws(block, [expected], [message])
  */

var player, oldXhr, oldSourceBuffer, xhrParams;

module('HLS', {
  setup: function() {
    var video  = document.createElement('video');
    document.querySelector('#qunit-fixture').appendChild(video);
    player = videojs(video);

    // make XHR synchronous
    oldXhr = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      this.open = function() {
        xhrParams = arguments;
      };
      this.send = function() {
        // if the request URL looks like one of the test manifests, grab the
        // contents off the global object
        var manifestName = (/.*\/(.*)\.m3u8/).exec(xhrParams[1]);
        if (manifestName) {
          manifestName = manifestName[1];
        }
        this.responseText = window.manifests[manifestName || xhrParams[1]];

        this.readyState = 4;
        this.onreadystatechange();
      };
    };

    // mock out SourceBuffer since it won't be available in phantomjs
    oldSourceBuffer = window.videojs.SourceBuffer;
    window.videojs.SourceBuffer = function() {
      this.appendBuffer = function() {};
    };
  },
  teardown: function() {
    window.XMLHttpRequest = oldXhr;
    window.videojs.SourceBuffer = oldSourceBuffer;
  }
});

test('loads the specified manifest URL on init', function() {
  var loadedmanifest = false, loadedmetadata = false;
  player.on('loadedmanifest', function() {
    loadedmanifest = true;
  });
  player.on('loadedmetadata', function() {
    loadedmetadata = true;
  });

  player.hls('manifest/playlist.m3u8');
  strictEqual(player.hls.readyState(), 0, 'the readyState is HAVE_NOTHING');
  videojs.mediaSources[player.currentSrc()].trigger({
    type: 'sourceopen'
  });
  ok(loadedmanifest, 'loadedmanifest fires');
  ok(loadedmetadata, 'loadedmetadata fires');
  ok(player.hls.manifest, 'the manifest is available');
  ok(player.hls.manifest.segments, 'the segment entries are parsed');
  strictEqual(player.hls.manifest,
              player.hls.currentPlaylist,
              'the playlist is selected');
  strictEqual(player.hls.readyState(), 1, 'the readyState is HAVE_METADATA');
});

test('starts downloading a segment on loadedmetadata', function() {
  player.hls('manifest/media.m3u8');
  videojs.mediaSources[player.currentSrc()].trigger({
    type: 'sourceopen'
  });

  strictEqual(xhrParams[1], 'manifest/00001.ts', 'the first segment is requested');
});

test('recognizes absolute URIs and uses them umnodified', function() {
  player.hls('manifest/absoluteUris.m3u8');
  videojs.mediaSources[player.currentSrc()].trigger({
    type: 'sourceopen'
  });

  strictEqual(xhrParams[1],
              'http://example.com/00001.ts',
              'the first segment is requested');
});

module('segment controller', {
  setup: function() {
    segmentController = new window.videojs.hls.SegmentController();
    this.vjsget = window.videojs.get;
    window.videojs.get = function(url, success) {
      success(window.bcSegment);
    };
  },
  teardown: function() {
    window.videojs.get = this.vjsget;
  }
});

test('bandwidth calulation test', function() {
  var
    multiSecondData = segmentController.calculateThroughput(10000, 1000, 2000),
    subSecondData = segmentController.calculateThroughput(10000, 1000, 1500);
  equal(multiSecondData, 80000, 'MULTI-Second bits per second calculation');
  equal(subSecondData, 160000, 'SUB-Second bits per second calculation');
});

})(window, window.videojs);
