'use latest';
import moment from 'moment';
import Twilio from 'twilio';
import fetch from 'isomorphic-fetch';

import express from 'express';
import { fromExpress } from 'webtask-tools';
import bodyParser from 'body-parser';

const app = express();
const gitOwner = 'pocorschi';
const gitRepo = 'TIL';
const timeBeforePublicShaming = 7; // days
const headers = {
  'User-Agent': 'TIL_WEBTASK',
};
let slack = {
  url: 'https://slack.com/api/',
  channel: '#bbs',
};

let ownPhoneNumber;
let twillioPhoneNumber;
let twillioAuthToken;
let twilioClient;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  ownPhoneNumber = req.webtaskContext.secrets.ownPhoneNumber;
  twillioPhoneNumber = req.webtaskContext.secrets.twillioPhoneNumber;
  twillioAuthToken = req.webtaskContext.secrets.twillioAuthToken;
  twilioClient = new Twilio(
    req.webtaskContext.secrets.twilioAccount,
    req.webtaskContext.secrets.twillioAuthToken
  );
  slack.token = req.webtaskContext.secrets.slackToken;

  getLatestCommit.then(checkLatestCommitTime).then(dateLastCommit => {
    console.log('dateLastCommit:', dateLastCommit);
    if (!moment(dateLastCommit).isSame(moment(), 'd')) {
      privateShame();
      if (moment().diff(dateLastCommit, 'd') > timeBeforePublicShaming) {
        console.log('publicly shaming');
        publicShame();
        res.status(200).send('all done');
      } else {
        console.log('not publicly shaming');
        res.status(200).send('all done');
      }
    }
  });
});

const getLatestCommit = new Promise((resolve, reject) => {
  fetch(
    `https://api.github.com/repos/${gitOwner}/${gitRepo}/git/refs/heads/master`,
    {
      method: 'GET',
      headers: headers,
    }
  )
    .then(resp => {
      return resp.json();
    })
    .then(resp => {
      resolve(resp.object.url);
    });
});

const checkLatestCommitTime = commitUrl => {
  return new Promise((resolve, reject) => {
    fetch(commitUrl, {
      method: 'GET',
      headers: headers,
    })
      .then(resp => {
        return resp.json();
      })
      .then(resp => {
        resolve(resp.author.date);
      });
  });
};

const privateShame = () => {
  console.log('inside private shame');
  twilioClient.messages
    .create({
      from: twillioPhoneNumber,
      to: ownPhoneNumber,
      body: "You haven't done your learning today. I am dissapoint",
      mediaUrl:
        'http://i1.kym-cdn.com/photos/images/newsfeed/000/003/866/nfNeT7YvTozx0cv7ze3mplZpo1_500.gif',
    })
    .then(message => console.log(message));
};

const publicShame = () => {
  console.log('publicly shaming');
  let slackParams = {
    token: slack.token,
    channel: slack.channel,
    link_names: 1,
    username: 'pocorschi TIL bot',
    text: `@pocorschi hasn't learned anything in the last ${timeBeforePublicShaming} days. Please message him to let him now how you feel about that.`,
  };

  fetch(slack.url + 'chat.postMessage ', {
    method: 'POST',
    headers: {
      'User-Agent': 'TIL_WEBTASK',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: uriEncodeParams(slackParams),
  });
};

const uriEncodeParams = params => {
  return Object.keys(params)
    .map(key => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
};

module.exports = fromExpress(app);

// TODO
//
// I could have multiple watched repos with different parameters and messages. Could store them in an online
// mongodb hosting such as mlab and have something like this stored in the repos collection:
// {
//   name: 'TIL repo',
//   gitOwner: 'pocorschi',
//   gitRepo: 'some_repo',
//   dailyCheck: true,
//   ownPhoneNumber: '+40720920494',
//   timeTillPublicShame: 7,
//   publicShameMessage: 'Son, I am dissapoint',
//   slack: {
//     token: 'XXX',
//     channel: 'XXX',
//     botName: 'XXX'
//   }
// }
