var sentiment = require('sentiment');
var git = require('nodegit');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var _ = require('lodash');

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory()
      && file.indexOf('.git') !== -1;
  });
}

var people = new Map();

var baseDirectory = argv.d ? argv.d : __dirname;
var repos = getDirectories(baseDirectory);
var promises = repos.map(repoName => {
  return git.Repository.open(path.join(baseDirectory, repoName)).then(function(repo) {
    var walker = git.Revwalk.create(repo);
    walker.pushHead();
    return walker.getCommitsUntil(c => true).then(function(commits) {
      var currentCommits = commits.map(commit => {
        try {
          var message = commit.message().split('\n')[0];
          var author = commit.author().name();
          var analysis = sentiment(message);
          var record = people.get(commit.author().name());
          if(record) {
            record.score += analysis.score;
            record.messages.push(message);
            if(analysis.score < record.worst.score) {
              record.worst.score = analysis.score;
              record.worst.message = message;
            } else if(analysis.score > record.best.score) {
              record.best.score = analysis.score;
              record.best.message = message;
            }
          } else {
            record =  {
              score: analysis.score,
              messages: [message],
              worst: {
                score: analysis.score,
                message: message
              },
              best: {
                score: analysis.score,
                message: message
              }
            };
          }
          people.set(author, record);
        } catch(error) {
          console.log('ERROR: '+error);
        }
      });
    });
  });
});

Promise.all(promises).then(function() {
  people.forEach(function(value, key) {
    console.log(key + ': ' + value.score + ' worst: ' + value.worst.score + ' ' + value.worst.message);
  });
});
