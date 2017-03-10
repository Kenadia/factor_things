'use strict'

const DEBUG_MODE = true;

// Params from the server:
// - groupNum
// - numGroups
// - maxNum
// - user
// - ignoreLevels
// - gameId

// Convert to zero-indexed.
groupNum -= 1;

let MODERATELY_BIG_PRIME_1 = 3759289
let MODERATELY_BIG_PRIME_2 = 8619943
let COLORS = ['gray', 'maroon', 'red', 'fuchsia', 'green',
              'navy', 'teal', 'orange', 'olive', 'rebeccapurple'];

// jQuery elements.
let $input;
let $label;
let $overlay;
let $statusText;

// Server info.
let levelData;

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
        levelData = response['data'];
        if (DEBUG_MODE) {
          console.debug('Got level data:', levelData);
        }
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
    remaining = new Distribution();
    let numList = getGroup(groupNum);
    for (let num of numList) {
      if (!(num in levelData)) {
        throw 'Missing level data for number ' + num;
      }
      let level = levelData[num];
      let weight = 1.0;
      if (!ignoreLevels) {
        weight /= (level + 1);
      }
      remaining.add(num, weight);
    }
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

class Distribution {
  constructor() {
    this.event_dict = {};
    this.length = 0;
    this.totalWeight = 0.0;
  }
  add(event, weight) {
    this.event_dict[event] = weight;
    this.length++;
    this.totalWeight += weight;
  }
  popRandom() {
    let random = Math.random() * this.totalWeight;
    let sum = 0.0;
    let event;
    for (event in this.event_dict) {
      sum += this.event_dict[event];
      if (sum > random) {
        break;
      }
    }
    this.totalWeight -= this.event_dict[event];
    delete this.event_dict[event];
    this.length--;
    return event;
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
    $.post('/finish', {
        user: user,
        game_id: gameId,
        error_count: errorCount,
    })
    return;
  }

  currentNum = parseInt(remaining.popRandom());
  let factors = factor(currentNum);
  if (DEBUG_MODE) {
    console.debug('Factored', currentNum, 'into', factors);
  }
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
  // Strip the ends.
  s = s.match(/^\s*(.*?),?\s*$/)[1]

  // Split on comma and/or whitespace.
  let values = s.split(/[,\s]+/);

  // Parse as integers.
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
