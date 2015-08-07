/**
 *
 *
 * npm publish <tarball> [--tag <tag>] [--access <public|restricted>]
 * npm publish <folder> [--tag <tag>] [--access <public|restricted>]
 *
 **/

var exports = module.exports;
var password = require('./../../../node_modules/password-hash-and-salt');
var md5 = require('./../../../node_modules/md5');
var extend = require('./../../../node_modules/extend');
var slice = Array.prototype.slice;

exports.password = password;
exports.md5 = md5;

var mysql_adapter = require('mysql-adapter');
// var util = require('util');
exports.connection = mysql_adapter.connection;
exports.AdapterConnection = mysql_adapter.AdapterConnection;
exports.cleanupApp = mysql_adapter.cleanupApp;
exports.createConnection = mysql_adapter.createConnection;
exports.getRootServer = mysql_adapter.getRootServer;

// exports.mysql = require('mysql');
// var rootModule = exports.getRootServer(module);
// var CONF = rootModule.exports.CONF;
// exports.CONF = CONF;
// rootModule.exports.defaultApp;


exports.getRootModule = function getRootModule(name, _module) {
    _module = _module || module;
    var pattern = new RegExp('/lib/'+name+'/(index|hello).js$');
    var mod = _module;
    while(true) {
        if( mod.id == '.' && mod.filename.match(/\/server\.js$/) ) {
            return null;
        }
        if( mod.id.match(pattern) && mod.filename.match(pattern) ) {
            return mod;
        }
        mod = mod.parent;
    }
    return null;
}

exports.getRootModuleModel = function getRootModuleModel(name, _module) {
    _module = _module || module;
    var pattern = new RegExp('/lib/'+name+'/models/(index|hello).js$');
    var mod = _module;
    while(true) {
        if( mod.id == '.' && mod.filename.match(/\/server\.js$/) ) {
            return null;
        }
        if( mod.id.match(pattern) && mod.filename.match(pattern) ) {
            return mod;
        }
        mod = mod.parent;
    }
    return null;
}

exports.getRootModuleController = function getRootModuleController(name, _module) {
    _module = _module || module;
    var pattern = new RegExp('/lib/'+name+'/controllers/(index|hello).js$');
    var mod = _module;
    while(true) {
        if( mod.id == '.' && mod.filename.match(/\/server\.js$/) ) {
            return null;
        }
        if( mod.id.match(pattern) && mod.filename.match(pattern) ) {
            return mod;
        }
        mod = mod.parent;
    }
    return null;
}

exports.getModuleInfo = function getModuleInfo(name, _module) {
    _module = _module || module;

    var result = {
        'current': _module,
        'root': exports.getRootServer(_module),
        'module': exports.getRootModule(name, _module),
        'controller': exports.getRootModuleController(name, _module),
        'model': exports.getRootModuleModel(name, _module)
    }
    result.appServer = result.root.exports;
    result.names = {
        current_id: result.current.id,
        current_name: result.current.filename,

        root_id: result.root.id,
        root_name: result.root.filename,

        module_id: result.module ? result.module.id : null,
        module_name: result.module ? result.module.filename : null,

        controller_id: result.controller ? result.controller.id : null,
        controller_name: result.controller ? result.controller.filename : null,

        model_id: result.model ? result.model.id : null,
        model_name: result.model ? result.model.filename : null
    }
    return result;
}


module.exports.intVal = function(number) {
    var result = parseInt(number);
    if( isNaN(result) ) {
        result = 0;
    }
    return result;
}

module.exports.floatVal = function(number) {
    var result = parseFloat(number);
    if( isNaN(result) ) {
        result = 0;
    }
    return result;
}

function extendFrom () {
    var excludes = [].slice.call(arguments);

    return function extendExclude () {
        var args = [true].concat(slice.call(arguments))
            , i = 1, orig = {};

        Object.keys(args[1]).forEach(function (key) {
            if (excludes.indexOf(key) > -1) {
                orig[key] = args[1][key];
            }
        });
        var result = extend.apply(this, args);
        result = extend(result, orig);
        return result;
    };
};

module.exports.dump = function(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    console.log( message + ': ' + JSON.stringify(args, null, '\t') );
}

module.exports.dumpExit = function(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    console.log( message + ': ' + JSON.stringify(args, null, '\t') );
    process.exit();
}

module.exports.extend = extend;
module.exports.extendFrom = extendFrom;