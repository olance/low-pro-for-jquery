(function($) {

  var addMethods = function(source) {
    var ancestor   = this.superclass && this.superclass.prototype;
    var properties = $.keys(source);

    if (!$.keys({ toString: true }).length) properties.push("toString", "valueOf");

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && $.isFunction(value) && $.argumentNames(value)[0] == "$super") {

        var method = value, value = $.extend($.wrap((function(m) {
          return function() { return ancestor[m].apply(this, arguments) };
        })(property), method), {
          valueOf:  function() { return method },
          toString: function() { return method.toString() }
        });
      }
      this.prototype[property] = value;
    }

    return this;
  };

  $.extend({
    keys: function(obj) {
      var keys = [];
      for (var key in obj) keys.push(key);
      return keys;
    },

    argumentNames: function(func) {
      var names = func.toString().match(/^[\s\(]*function[^(]*\((.*?)\)/)[1].split(/, ?/);
      return names.length == 1 && !names[0] ? [] : names;
    },

    bind: function(func, scope) {
      return function() {
        return func.apply(scope, $.makeArray(arguments));
      };
    },

    wrap: function(func, wrapper) {
      var __method = func;
      return function() {
        return wrapper.apply(this, [$.bind(__method, this)].concat($.makeArray(arguments)));
      };
    },

    klass: function() {
      var parent = null, properties = $.makeArray(arguments);
      if ($.isFunction(properties[0])) parent = properties.shift();

      var klass = function() {
        this.initialize.apply(this, arguments);
      };

      klass.superclass = parent;
      klass.subclasses = [];
      klass.addMethods = addMethods;

      if (parent) {
        var subclass = function() { };
        subclass.prototype = parent.prototype;
        klass.prototype = new subclass;
        parent.subclasses.push(klass);
      }

      for (var i = 0; i < properties.length; i++)
        klass.addMethods(properties[i]);

      if (!klass.prototype.initialize)
        klass.prototype.initialize = function() {};

      klass.prototype.constructor = klass;

      return klass;
    },
    eventDelegate: function(rules) {
      return function(e) {
        var target = $(e.target), parent = null;
        for (var selector in rules) {
          if (target.is(selector) || ((parent = target.parents(selector)) && parent.length > 0)) {
            return rules[selector].apply(this, [parent || target].concat($.makeArray(arguments)));
          }
          parent = null;
        }
      };
    }
  });

  var bindEvents = function(instance) {
    for (var member in instance) {
      if (member.match(/^on(.+)/) && typeof instance[member] == 'function') {
        instance.element.live(RegExp.$1, {'behavior': instance}, instance[member]);
      }
    }
  };

  var behaviorWrapper = function(behavior) {
    return $.klass(behavior, {
      initialize: function($super, element, args) {
        this.element = element;
        if ($super) $super.apply(this, args);
      },
      trigger: function(eventType, extraParameters) {
        var parameters = [this].concat(extraParameters);
        this.element.trigger(eventType, parameters);
      }
    });
  };

  var attachBehavior = function(el, behavior, args) {
      var wrapper = behaviorWrapper(behavior);
      var instance = new wrapper(el, args);

      bindEvents(instance);

      if (!behavior.instances) behavior.instances = [];

      behavior.instances.push(instance);

      return instance;
  };


  $.fn.extend({
    attach: function() {
      var args = $.makeArray(arguments), behavior = args.shift();
      attachBehavior(this, behavior, args);
      return this;
    },
    eventDelegate: function(type, rules) {
      return this.bind(type, $.eventDelegate(rules));
    },
    attached: function(behavior) {
      var instances = [];

      if (!behavior.instances) return instances;

      this.each(function(i, element) {
        $.each(behavior.instances, function(i, instance) {
          if (instance.element.get(0) == element) instances.push(instance);
        });
      });

      return instances;
    },
    firstAttached: function(behavior) {
      return this.attached(behavior)[0];
    }
  });

  var Remote = $.klass({
    initialize: function(options) {
      if (this.element.attr('nodeName') == 'FORM') this.element.attach(Remote.Form, options);
      else this.element.attach(Remote.Link, options);
    }
  });

  Remote.Base = $.klass({
    initialize : function(options) {
      this.options = $.extend(true, {}, options || {});
    },
    _makeRequest : function(options) {
      $.ajax(options);
      return false;
    }
  });

  Remote.Link = $.klass(Remote.Base, {
    onclick: function(e) {
      var options = $.extend({ 
        url: $(this).attr('href'), 
        type: 'GET' 
      }, this.options);
      return e.data.behavior._makeRequest(e.data.behavior.options);
    }
  });

  Remote.Form = $.klass(Remote.Base, {
    onclick: function(e) {
      var target = e.target;

      if ($.inArray(target.nodeName.toLowerCase(), ['input', 'button']) >= 0 && target.type.match(/submit|image/))
        e.data.behavior._submitButton = target;
    },
    onsubmit: function(e) {
      var elm = $(this), data = elm.serializeArray();

      if (e.data.behavior._submitButton) data.push({ 
        name: e.data.behavior._submitButton.name, 
        value: e.data.behavior._submitButton.value 
      });

      var options = $.extend({
        url : elm.attr('action'),
        type : elm.attr('method') || 'GET',
        data : data
      }, e.data.behavior.options);

      e.data.behavior._makeRequest(options);

      return false;
    }
  });

  $.ajaxSetup({
    beforeSend: function(xhr) {
      if (!this.dataType)
        xhr.setRequestHeader("Accept", "text/javascript, text/html, application/xml, text/xml, */*");
    }
  });

})(jQuery);
