/**
 *
 *
 * npm publish <tarball> [--tag <tag>] [--access <public|restricted>]
 * npm publish <folder> [--tag <tag>] [--access <public|restricted>]
 * npm publish . --tag "first-version" --access "public"
 **/
var util = require('util');
var exports = module.exports;
var password = require('password-hash-and-salt');
var md5 = require('md5');
var extend = require('extend');
var slice = Array.prototype.slice;
exports.password = password;
exports.md5 = md5;
var querystring = require('querystring');

exports.router = require('auto-route/index');
var mysql_adapter = require('mysql-adapter');

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

var common = exports;
exports.initRunningApp = function initRunningApp(express, runningApp, CONF, swig) {
  var app_root_dir = runningApp.__dirname;
  runningApp.set('case sensitive routing', CONF.app.caseSensitive || 0);

  runningApp.formatUrl = function(routerName, params, req) {
    var urlFormat = '';
    var query = {}, hash = '';
    if( Array.isArray(routerName) ) {
      if( routerName.length == 3 ) {
        var moduleName = routerName[0].replace(/\//g, '_');
        var controller = routerName[1].replace(/\//g, '_');
        var action = routerName[2];

        urlFormat = util.format('/%s/%s/%s/', moduleName, controller, action);

        if( Array.isArray(params) ) {
          urlFormat += params.join('/');
        } else if( typeof(params) == 'object' ) {
          Object.keys(params).forEach(function(name){
            if( name == '_query' ) {
              query = params[name];
            } else if( name == '_hash' ) {
              hash = params[name];
            } else {
              urlFormat += name + '/' + params[name];
            }
          });
        } else {
          urlFormat += params;
        }
      }
      throw new Error("Invalid param of formatUrl");
    } else {
      routerName = routerName.replace(/\//g, '-');
      if( !(routerName in runningApp.routerNames) ) {
        throw new Error( util.format('Not found router name "%s"', routerName) );
      }

      urlFormat = runningApp.routerNames[routerName].urlFormat;


      if( typeof(params) == 'object' && !Array.isArray(params) ) {
        Object.keys(params).forEach(function(name){
          if( name == '_query' ) {
            query = params[name];
          } else if( name == '_hash' ) {
            hash = params[name];
          } else {
            eval("var regx = /(:" + name.replace(/\-/g, '\\-') + ")/;");
            if (urlFormat.match(regx)) {
              urlFormat = urlFormat.replace(regx, params[name]);
            } else {
              query[name] = params[name];
            }
          }
        });
      }

      params = runningApp.routerNames[routerName].params;
      Object.keys(params).forEach(function(key) {
        eval("var regx = /(:"+key.replace(/\-/g, '\\-')+")/;");
        urlFormat = urlFormat.replace(regx, (params[key]['default'] || '') );
      });
    }
    if( Object.keys(query).length ) {
      query = querystring.stringify(query);
      if( query.length ) {
        urlFormat += '?' + query
      }
    }
    if( hash.length ) {
      urlFormat += '#' + hash;
    }
    return urlFormat;
  };

  runningApp.use(function(req, res, next) {
    // https://github.com/lorenwest/node-config/wiki/Configuration-Files
    function loadFile(type, name) {
      type = '/' + type.replace(/^\/+|\/+$/g, '') + '/';
      if( Array.isArray(name) ) {
        var moduleName = '', fileName = 'index';
        if( name.length > 1 ) {
          fileName = name[1];
        }
        moduleName = name[0];
        fileName = fileName.replace(/\.js$/, '');
        name = util.format('%s%s%s', moduleName, type, fileName);
      } else if( typeof(name) == 'string' ){
        name = name.replace(/\.js/, '');
        name = name.replace(/\-/g, '/');
        name = name.replace(/\./, type);
      }
      return require( app_root_dir + '/' + name + '.js');
    }

    req.getBlock = function() {
      var args = Array.prototype.slice.call(arguments);
      args = args.unshift('blocks');
      return loadFile.apply(null, args);
    }

    req.getForm = function() {
      var args = Array.prototype.slice.call(arguments);
      args = args.unshift('blocks/forms');
      return loadFile.apply(null, args);
    }

    req.getController = function() {
      var args = Array.prototype.slice.call(arguments);
      args = args.unshift('controllers');
      return loadFile.apply(null, args);
    }

    req.getHelper = function(name) {
      var args = Array.prototype.slice.call(arguments);
      args = args.unshift('helpers');
      return loadFile.apply(null, args);
    }

    req.getView = function() {
      var args = Array.prototype.slice.call(arguments);
      args = args.unshift('views');
      return loadFile.apply(null, args);
    }

    req.formatUrl = function(routerName, params) {
      return runningApp.formatUrl.apply(runningApp, [routerName, params, req]);
    }
    next();
  });

  if( 'modules' in CONF ) {
    // Loop to all module in folder webroot/lib/<module name>
    Object.keys(CONF.modules).forEach(function(moduleName) {
      var modConf = CONF.modules[moduleName];
      // console.log("CONF.modules." + moduleName + " check for loading");
      if( modConf.enable ) {
        console.log("CONF.modules." + moduleName + " check for loading " + app_root_dir + modConf.dirname);
        if( 'public' in modConf && modConf['public'].length ) {
          console.log("CONF.modules." + moduleName + " check for loading static folder " + app_root_dir + modConf.dirname + modConf['public']);
          runningApp.use( express.static(app_root_dir + modConf.dirname + modConf['public']) );
        }
        if( 'routers' in modConf ) {
          var modulePrefixPath = '/' + modConf.urlpath.replace(/^\/+|\/+$/g, '') + '/';
          Object.keys(modConf.routers).forEach(function(controllerName) {
            var controller = modConf.routers[controllerName];
            Object.keys(controller).forEach(function(actionName, idx) {
              var route = controller[actionName];
              CONF.modules[moduleName].routers[controllerName][actionName].controller = route.controller = controllerName.replace(/\-/g, '/');
              CONF.modules[moduleName].routers[controllerName][actionName].action = route.action = actionName;
              CONF.modules[moduleName].routers[controllerName][actionName].prefix = route.moduleName = moduleName;
              CONF.modules[moduleName].routers[controllerName][actionName].prefix = route.prefix = modulePrefixPath;
              if( 'params' in route ) {
                Object.keys(route.params).forEach(function(key, idx1) {
                  var param = route.params[key];
                  if( 'format' in param ) {
                    var format = new RegExp(param.format);
                    runningApp.param(key, function(req, res, next) {
                      if( format instanceof RegExp ) {
                        if( !req.params[key].match(format) ) {
                          if( 'default' in param ) {
                            req.params[key] = param['default'];
                          } else {
                            if( 'error' in param ) {
                              return next(new Error( util.format(param.error, req.params[key]) ));
                            } else {
                              return next(new Error( util.format('This field "%s" have value "%s" invalid with format "%s"', key, req.params[key], param.format) ));
                            }
                          }
                        } // Valid format
                        CONF.modules[moduleName].routers[controllerName][actionName].params[key].format = param.format = format;
                      } else {
                        return next( new Error("Can't load ") )
                      }
                      next();
                    }); // End param of app
                  } // End format
                });
              } // End params of route
              // var info = common.getModuleInfo(moduleName, module);
              route.runningApp = runningApp;
              runningApp.routerNames[ util.format('%s.%s', controllerName, actionName) ] = route;
              route.url = route.prefix + route.urlFormat;
              if( 'required_auth' in route && route.required_auth ) {
                runningApp[route.method](route.url, function checkAuth(req, res, next) {

                }, common.router.routeUrlFormat(route) );
              } else {
                runningApp[route.method](route.url, common.router.routeUrlFormat(route) );
              }
            });
          });
        } else {
          var moduleObj = require(app_root_dir + modConf.dirname);
          module.exports[moduleName] = moduleObj; // urlpath
          runningApp.use(modConf.urlpath, moduleObj); // attach to sub-route
        }
      }
    });
  }

  // Handle 404
  runningApp.use(function(req, res) {
    runningApp.engine('twig', swig.renderFile);
    runningApp.set('view engine', 'twig');
    runningApp.set('views', app_root_dir + '/lib/sata/views');

    res.status(400);
    res.render('404', {title: '404: File Not Found'});
  });

  // Handle 500
  runningApp.use(function(error, req, res, next) {
    runningApp.engine('twig', swig.renderFile);
    runningApp.set('view engine', 'twig');
    runningApp.set('views', app_root_dir + '/lib/sata/views');
    res.status(500);
    res.render('500', {title:'500: Internal Server Error', error: error});
  });

  return runningApp;
}








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

function ObjectManager() {
    var managers = {};
    return {
        newInstance: function(name, _class) {

            if( !(name in managers) ) {
                var str = util.format("var obj = new %s();", name, _class);
                // eval('managers['+name+'] = new ' + _class + '();';
                eval(str);
                managers[name] = obj;
            }
            return managers[name];
        },
        register: function(name, obj) {
            managers[name] = obj;
            return obj;
        },
        unregister: function(name) {
            var obj = null;
            if( name in managers ) {
                obj = managers[name];
                delete managers[name];
            }
            return obj;
        },
        registry: function(name) {
            if( name in managers ) {
                return managers[name];
            }
            return null;
        }
    }
}
module.exports.ObjectManager = new ObjectManager();
