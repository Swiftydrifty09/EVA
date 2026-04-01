/*
Trying to understand the code?
A good starting point: https://github.com/hchiam/language-user-interface/blob/master/brain.js
*/

// link to pen page:
_showRedirectLinkAsNeeded('WOLOJG');

var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
if (!isChrome) {
  $('#use-chrome').text('For best results, open this page in Chrome.');
  $('#use-chrome').css({color:'lightgrey', background:'blue'});
}

// disable listening on the home page:
var fullPageURL = window.URL.toString().includes('/full');
if (document.URL !== fullPageURL) {
  // (see ear.js and brain.js)
  recognition.stop();
  // listening = false;
  // recognizing = false;
}

// -------------------------

/* import code dynamically from github using rawgit (see Settings, JavaScript) :
https://rawgit.com/hchiam/voiceUserInterface/master/brain.js
*/

// var delayedAction;

// function converse() {
//   clearTimeout(delayedAction); // reset if still typing
//   delayedAction = setTimeout(function(){
//     var heard = listen();
//     if (heard) speak(heard);
//   }, 2000);
// }

// function listen() {
//   var heard = document.getElementById("input").value;
//   return heard;
// }

// function speak(heard) {
//   // TODO: add more functionality
//   var say = "You said: " + heard;
//   responsiveVoice.speak(say, 'UK English Male');
// }


// // override to customize gesture-detection functions from https://rawgit.com/hchiam/webApp_MachineLearning_Gesture/master/detect-gesture-import.js:
// specialAction_UpDown();
// specialAction_LeftRight();
// specialAction_ClockWise();

function specialAction_UpDown() {
  let clr = 'lightyellow';
  updateBackground(clr);
}

function specialAction_LeftRight() {
  let clr = 'lightblue';
  updateBackground(clr);
}

function specialAction_ClockWise() {
  let clr = 'lightgreen';
  updateBackground(clr);
}

function updateBackground(colour) {
  document.body.style.background = colour;
}

// ----------------------------

///////// RESPONSIVE ANIMATION:

const wsvg = 50;
const hsvg = 50;
const offsetx = 0;
const offsety = hsvg/2;
let shiftx = 0;
let shifty = hsvg/2;
let points = '';
let points2 = '';
let points3 = '';
let x, y, y2, y3;
if (typeof timer === 'undefined') {
  let timer;
}
let temporary;
const slowInterval = 40;
const fastInterval = 10;
let interval = slowInterval;

addPoints();
showLine();
animate();

function addPoint(x,y) {
  points += ' ' + (x+offsetx) + ',' + (y+offsety);
}
function addPoint2(x,y) {
  points2 += ' ' + (x+offsetx) + ',' + (y+offsety);
}
function addPoint3(x,y) {
  points3 += ' ' + (x+offsetx) + ',' + (y+offsety);
}
function addPoints() {
  // set up x range
  x = createX(0, wsvg, 1);
  // actually add the points
  for (i in x) {
    y = hsvg/5*Math.sin(x[i]*4/wsvg-shiftx) * Math.sqrt(1-Math.pow((x[i]-wsvg/2)*2/wsvg,2));
    addPoint(x[i],y);
    y2 = hsvg/5*Math.sin(x[i]*4/wsvg-shiftx/2) * Math.sqrt(1-Math.pow((x[i]-wsvg/2)*2/wsvg,2));
    addPoint2(x[i],y2);
    y3 = hsvg/4*Math.sin(x[i]*10/wsvg-shiftx) * Math.sqrt(1-Math.pow((x[i]-wsvg/2)*2/wsvg,2));
    addPoint3(x[i],y3);
  }
}
function createX(start,end,interval) {
  let xv = [];
  for (let i=start; i<=end; i+=interval) {
    xv.push(i);
  }
  return xv;
}

function showLine() {
  document.getElementById('line').setAttribute('points', points);
  document.getElementById('line2').setAttribute('points', points2);
  document.getElementById('line3').setAttribute('points', points3);
}

function animate() {
  timer = setInterval(animateFunction, interval);
}
function animateFunction() {
  points = '';
  points2 = '';
  points3 = '';
  shiftx += 0.1;
  addPoints();
  showLine();
}
function clicked() {
  setUp_webkitSpeechRecognition();
  toggleStart_webkitSpeechRecognition();
  // reset timer with fast interval
  clearInterval(timer);
  timer = setInterval(animateFunction, fastInterval);
  // reset timer with slow interval
  let resetAfter = 1000;
  temporary = setTimeout(temporaryChange, resetAfter);
}
function temporaryChange() {
  clearInterval(timer);
  timer = setInterval(animateFunction, slowInterval);
}

// -------------------------

window.mobilecheck = function() {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

var isMobile = window.mobilecheck();
if (isMobile) {
  $('#use-laptop').text('Wait for the beep. For faster voice recognition, use a laptop.');
  $('#use-laptop').css({color:'lightgrey', background:'darkgreen'});
}

// ----------------------
