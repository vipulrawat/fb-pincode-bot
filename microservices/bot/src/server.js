var request = require('request');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

let FACEBOOK_VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;
let FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
let PIN_API_TOKEN = process.env.PIN_API_TOKEN;
let FACEBOOK_SEND_MESSAGE_URL = 'https://graph.facebook.com/v2.6/me/messages?access_token=' + FACEBOOK_PAGE_ACCESS_TOKEN;
let PIN_API_URL = `https://api.data.gov.in/resource/6176ee09-3d56-4a3b-8115-21841576b2f6?format=json&api-key=`+PIN_API_TOKEN+`&filters[officename]=`;

//your routes here
app.get('/', function (req, res) {
    res.send("Hello World, I am a bot.");
});

app.get('/webhook/', function(req, res) {
  if (req.query['hub.verify_token'] === FACEBOOK_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge'])
        return;
    }
    res.send('Error, wrong token')
});

app.post('/webhook/', function(req, res) {
  console.log(JSON.stringify(req.body));
  if (req.body.object === 'page') {
    if (req.body.entry) {
      req.body.entry.forEach(function(entry) {
        if (entry.messaging) {
          entry.messaging.forEach(function(messagingObject) {
              var senderId = messagingObject.sender.id;
              if (messagingObject.message) {
                if (!messagingObject.message.is_echo) {
                  //Assuming that everything sent to this bot is a place name.
                  var placeName = messagingObject.message.text;
                  getPinDetail(senderId, placeName);
                }
              } else if (messagingObject.postback) {
                console.log('Received Postback message from ' + senderId);
              }
          });
        } else {
          console.log('Error: No messaging key found');
        }
      });
    } else {
      console.log('Error: No entry key found');
    }
  } else {
    console.log('Error: Not a page object');
  }
  res.sendStatus(200);
})

//sendMessageToUser sends the "message" paramter as a message to the user
function sendMessageToUser(senderId, message) {
  request({
    url: FACEBOOK_SEND_MESSAGE_URL,
    method: 'POST',
    json: {
      recipient: {
        id: senderId
      },
      message: {
        text: message
      }
    }
  }, function(error, response, body) {
        if (error) {
          console.log('Error sending message to user: ' + error);
        } else if (response.body.error){
          console.log('Error sending message to user: ' + response.body.error);
        }
  });
}

function showTypingIndicatorToUser(senderId, isTyping) {
  var senderAction = isTyping ? 'typing_on' : 'typing_off';
  request({
    url: FACEBOOK_SEND_MESSAGE_URL,
    method: 'POST',
    json: {
      recipient: {
        id: senderId
      },
      sender_action: senderAction
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending typing indicator to user: ' + error);
    } else if (response.body.error){
      console.log('Error sending typing indicator to user: ' + response.body.error);
    }
  });
}
/* Function that is used to change the first letter of every alphabet to UpperCase.
*   For ex: If user types rishikesh, this function converts it to rishikesh
*/
function titleCase(str) {
  str = str.toLowerCase().split(' ');
  for (var i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
  }
  return str.join(' ');
}
// Function to extract the pincode of the place
function getPinDetail(senderId, placeName) {                //Function to get Pincode of all SubPostOffices
  showTypingIndicatorToUser(senderId, true);
  placeName=titleCase(placeName);
  placeName = placeName+' S.O'; //Every PostOffice in the city is either a SubPost-Office (S.O) or Branch-Office (B.O)
  let restUrl = PIN_API_URL+placeName;
  request.get(restUrl, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      let json = JSON.parse(body);
      if(json.total==0){
        let newplaceName = placeName.slice(0,-3)+'B.O';
          getPinDetailNew(senderId,newplaceName);
      }else{
        let state = json.records[0].statename;    //State Name
        state = JSON.stringify(state);
        json = json.records[0].pincode;           //Pincode
        json= JSON.stringify(json);
        let msg = `Pincode of `+placeName+`,`+state+` is:`+json;
          showTypingIndicatorToUser(senderId, true);
          sendMessageToUser(senderId, msg);
          showTypingIndicatorToUser(senderId, false);
      }
    } else {
      let errorMessage = 'Could not find any information of the place.';
      showTypingIndicatorToUser(senderId, true);
      sendMessageToUser(senderId, errorMessage);
      showTypingIndicatorToUser(senderId, false);
    }
  });
}
function getPinDetailNew(senderId, placeName) {                     //Function to get Pincode of all BranchOffices
  showTypingIndicatorToUser(senderId, true);
  let restUrl = PIN_API_URL+placeName;
  request.get(restUrl, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      let json = JSON.parse(body);
      if(json.total==0){
        showTypingIndicatorToUser(senderId, true);
        sendMessageToUser(senderId, "I am unable to get your pincode. Pincode is alloted to the nearest PostOffice Name not the city/place.Try Again!");
        showTypingIndicatorToUser(senderId, false);
      }else{
        let state = json.records[0].statename;    //State Name
        state = JSON.stringify(state);
        json = json.records[0].pincode;           //Pincode
        json= JSON.stringify(json);
        let msg = `Pincode of `+placeName+`,`+state+` is:`+json;
          showTypingIndicatorToUser(senderId, true);
          sendMessageToUser(senderId, msg);
          showTypingIndicatorToUser(senderId, false);
      }
    } else {
      let errorMessage = 'Could not find any information on search Term: ' + searchTerm + ' .';
      showTypingIndicatorToUser(senderId, true);
      sendMessageToUser(senderId, errorMessage);
      showTypingIndicatorToUser(senderId, false);
    }
  });
}
app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});
