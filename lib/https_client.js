/*
 * Wire
 * Copyright (C) 2017 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

const debug = require('debug')('wire:bot-api:https_client');
const https = require('follow-redirects').https;

module.exports = class HttpsClient {
  constructor(token) {
    this.token = token;
  }

  static onError(req, e, cb) {
    if (req.errorCnt > 1) {
      return;
    }
    if (e) {
      debug(`Request error: ${JSON.stringify(e)}`);
    } else {
      debug('Request timeout.');
      req.abort();
    }
    cb(null, 0);
  }

  sendRequest(method, path, data, additionalHeaders, cb) {
    const options = {
      hostname: 'prod-nginz-https.wire.com',
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };
    if (additionalHeaders != null) {
      Object.keys(additionalHeaders).forEach((hKey) => {
        options.headers[hKey] = additionalHeaders[hKey];
      });
    }
    debug(options.headers);
    const req = https.request(options, (res) => {
      let responseData = [];
      res.on('data', (chunk) => {
        debug('got data from https');
        responseData.push(chunk);
      });
      res.on('end', () => {
        debug(`req end from https ${res.statusCode}`);
        responseData = Buffer.concat(responseData);
        cb(responseData, res.statusCode);
      });
    });

    req.errorCnt = 0;
    req.on('error', (e) => {
      req.errorCnt += 1;
      HttpsClient.onError(req, e, cb);
    });
    req.setTimeout(15000, () => {
      req.errorCnt += 1;
      HttpsClient.onError(req, null, cb);
    });

    if (data !== null) {
      if (Buffer.isBuffer(data)) {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  }

  sendMessage(postData, ignoreMissing, cb) {
    const path = `/bot/messages?ignore_missing=${ignoreMissing}`;
    this.sendRequest('POST', path, postData, null, (retData, status) => {
      const json = JSON.parse(retData.toString('utf8')); // fixme: try/catch
      cb(json, status);
    });
  }

  getClients(postData, cb) {
    this.sendRequest('GET', '/bot/client', postData, null, cb);
  }

  getPrekeys(forUsersAndDevices, cb) {
    debug(`getprekeys ${JSON.stringify(forUsersAndDevices)}`);
    this.sendRequest('POST', '/bot/users/prekeys', forUsersAndDevices, null, (retData, status) => {
      const json = JSON.parse(retData.toString('utf8')); // fixme: try/catch
      cb(json, status);
    });
  }

  getAsset(assetID, assetToken, cb) {
    debug(`assetID ${assetID} token ${assetToken}`);
    this.sendRequest('GET', `/bot/assets/${assetID}`, null,
    { 'Asset-Token': assetToken }, cb);
  }

  uploadAsset(assetData, cb) {
    this.sendRequest('POST', '/bot/assets', assetData, {
      'Content-Type': 'multipart/mixed; boundary=frontier',
      'Content-Length': assetData.length }, cb);
  }
};
