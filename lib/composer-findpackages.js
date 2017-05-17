var path = require('path')
var _ = require('underscore')
var Promise = require('bluebird')
var glob = require('glob')
var fs = Promise.promisifyAll(require('fs'))

function getProjectDependencies(project) {
  var dependencies = [];

  var version = project.version;
  var deps = project.require;

  for (var dep in deps) {
    if (dep.split('/').length !== 2) continue
    var depVersion = deps[dep];
    dependencies.push({
      name: dep,
      version: depVersion || ''
    });
  }

  return dependencies
}

module.exports = function(dir, ignores) {
  return new Promise(function (resolve, reject) {
    glob(path.join(dir, '**/composer.json'), { }, function (err, files) {
      if (err) {
        console.error('Error finding composer files:', err);
        process.exit(1);
        return reject(err)
      }
      return resolve(files)
    })
  })
  .then(function (files) {
    // check that files are not ignored
    if (ignores) {
      files = _.filter(files, function(file) {
        file = file.toLowerCase();
        for (var i = 0; i < ignores.length; i++) {
          if (file.indexOf(ignores[i]) >= 0) return false; // skip processing file
        }
        return true;
      });
    }
     
    if (files.length === 0) {
      return []
    } else {
      return Promise.map(files, function (file) {
        var dir_name = path.dirname(file);
        var all_files
        return fs.readFileAsync(file, {
          encoding: 'utf-8'
        })
        .tap(function () {
          return new Promise(function (resolve, reject) { // Get files
            glob(path.join(dir_name, '**/*.php'), {}, function (err, files) {
              if (err) {
                console.error('Error finding php files:', err);
                process.exit(1);
                return reject(err)
              }
              all_files = files
              return resolve()
            })
          })
        })
        .then(function (composer_json) {
          var project = JSON.parse(composer_json);
          var dependencies = getProjectDependencies(project)
          var source_unit = {
            name: project.name,
            version: project.version || 1.0, // no version in composer.json usually
            files: all_files,
            dependencies: dependencies,
            dir: dir_name
          }
          if (project.license) {
            if (_.isArray(project.license)) {
              source_unit.licenses = project.license
            } else {
              source_unit.license = project.license
            }
          }
          return source_unit
        })
      })
    }
  })
}