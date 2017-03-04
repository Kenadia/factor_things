'use strict'

// Parse query params. They are all optional.
let uri = new Uri(location.href);
let groupNum = parseInt(uri.getQueryParamValue('group'));
let numGroups = parseInt(uri.getQueryParamValue('num_groups')) || 10;
let maxNum = parseInt(uri.getQueryParamValue('max_num')) || 100;
let user = uri.getQueryParamValue('user');
let ignore_levels = uri.getQueryParamValue('ignore_levels') === 'true';

let MODERATELY_BIG_PRIME_1 = 3759289
let MODERATELY_BIG_PRIME_2 = 8619943
let COLORS = ['gray', 'maroon', 'red', 'fuchsia', 'green',
              'navy', 'teal', 'orange', 'olive', 'rebeccapurple'];

// jQuery elements.
let $input;
let $label;
let $overlay;
let $statusText;

// State.
let started = false;
let remaining = null;
let initialCount = null;
let errorCount = null;
let currentNum = null;
let currentFactorsCount = null;
let firstTry = null;

function main() {
  $input = $('.js-input');
  $label = $('.js-label');
  $overlay = $('.js-overlay');
  $statusText = $('.js-status-text');

  if (user === undefined) {
    setUp();
    return
  }

  ($.get('/levels', {'user': user, 'max_num': maxNum})
      .done(function (response) {
        console.log('Got response ', response);
        setUp();
      })
      .fail(function (error) {
        $label.text('Could not load the page, an error occurred.');
      }));
}

function setUp() {
  let initialMessage = ''

  if (user !== undefined) {
    initialMessage += 'Hello, ' + capitalize(user) + '. ';
  }

  if (groupNum === undefined) {
    initialMessage += ('Enter group number to start (0 to ' +
                      (numGroups - 1) + ').');
  } else {
    initialMessage += 'Hit enter to begin.';
  }
  $label.text(initialMessage);

  $input.focus();
  $input.on('keypress', function (e) {
    if (e.which === 13) {
      try {
        submit($input.val());
      } catch (e) {
        alert('Error: ' + e);
      }
      $input.val('');
    }
  });
}

function capitalize(s) {
  if (s === '') {
    return '';
  }
  return s[0].toUpperCase() + s.slice(1);
}

function submit(input) {
  if (!started) {
    if (groupNum === undefined) {
      groupNum = parseInt(input);
      if (isNaN(groupNum)) {
        throw 'Invalid group number "' + input + '"';
      }
    }

    // Initialize the state.
    remaining = getGroup(groupNum);
    initialCount = remaining.length;
    errorCount = 0;
    nextNum();
    started = true;
    $label.addClass('js-is-active');
  } else {
    let intList = parseIntList(input);
    if (intList.length === 0) {
      return;
    }
    if (areCorrectFactors(intList)) {
      if (user !== undefined && firstTry) {
        $.post('/up', {'user': user, 'number': currentNum});
      }
      nextNum();
    } else {
      if (user !== undefined) {
        $.post('/down', {'user': user, 'number': currentNum});
      }
      flashBackground('red');
      errorCount++;
      firstTry = false;
    }
  }
}

function nextNum() {
  if (remaining.length === 0) {
    // Finish.
    $label.text('Done!');
    $label.removeAttr('style');
    $label.removeClass('js-is-active');
    $input.remove();
    $statusText.text('You factored ' + initialCount + ' numbers' +
                     ' with ' + errorCount + ' errors.');
    return;
  }

  let chosenIndex = Math.floor(Math.random() * remaining.length);
  currentNum = remaining.splice(chosenIndex, 1)[0];
  let factors = factor(currentNum);
  console.debug('Factored ', currentNum, ' into ', factors);
  currentFactorsCount = factors.length;
  firstTry = true;

  $label.text(currentNum);
  $label.css('color', toColor(currentNum));
  $statusText.text('Remaining: ' + (remaining.length + 1));
}

function factor(x) {
  if (x < 1) {
    throw 'Cannot factor ' + x;
  }
  if (x === 1) {
    return [1];
  }
  let bound = Math.floor(Math.sqrt(x));
  for (let i = 2; i <= bound; i++) {
    if (x % i === 0) {
      let factors = [i].concat(factor(x / i));
      return factors;
    }
  }
  return [x];
}

function parseIntList(s) {
  let values = s.split(/[,\s]+/);
  if (values.length > 0 && /^\s*$/.test(values[values.length - 1])) {
    values.pop();
  }
  let ints = [];
  for (let value of values) {
    let int = parseInt(value);
    if (isNaN(int)) {
      throw 'Invalid response, "' + value + '" is not a number';
    }
    ints.push(int);
  }
  return ints;
}

function areCorrectFactors(intList) {
  return (intList.length === currentFactorsCount &&
          verifyProduct(intList, currentNum));
}

function verifyProduct(intList, expectedProduct) {
  if (intList.length === 1) {
    return intList[0] === expectedProduct;
  }
  let product = 1;
  for (let int of intList) {
    // The number 1 is not allowed unless it is the only factor.
    if (int === 1) {
      return false;
    }
    product *= int;
  }
  return product === expectedProduct;
}

function flashBackground(color) {
  ($overlay
      .stop()
      .css('background-color', color)
      .css('opacity', 0.3)
      .animate({'opacity': 0}, 300));
}

function getGroup(groupNum) {
  if (groupNum < 0 || groupNum >= numGroups) {
    throw ('Invalid group number ' + groupNum +', ' +
           'max is ' + (numGroups - 1));
  }
  let group = [];
  for (let i = 1; i <= maxNum; i++) {
    if (toGroup(i) === groupNum) {
      group.push(i);
    }
  }
  return group;
}

function toColor(x) {
  return COLORS[hash1(x, COLORS.length)];
}

function toGroup(x) {
  return hash2(x, numGroups);
}

function hash1(x, mod) {
  return fastModularExponentiation(x, MODERATELY_BIG_PRIME_1,
                                   MODERATELY_BIG_PRIME_2) % mod;
}

function hash2(x, mod) {
  return fastModularExponentiation(x, MODERATELY_BIG_PRIME_2,
                                   MODERATELY_BIG_PRIME_1) % mod;
}

// https://gist.github.com/krzkaczor/0bdba0ee9555659ae5fe
function fastModularExponentiation(a, b, n) {
  a = a % n;
  var result = 1;
  var x = a;

  while(b > 0){
    var leastSignificantBit = b % 2;
    b = Math.floor(b / 2);

    if (leastSignificantBit == 1) {
      result = result * x;
      result = result % n;
    }

    x = x * x;
    x = x % n;
  }
  return result;
};

$(document).ready(main);