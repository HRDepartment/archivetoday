'use strict';

// See index.d.ts for docs
const fetch = require('node-fetch');
const UserAgent = require('user-agents');

exports.snapshot = async function snapshot(args) {
  const {
    url,
    // Without a user agent, force archiving won't work
    userAgent = new UserAgent().toString(),
    renew = false,
    complete = true,
  } = args;
  // Mutated
  let { archiveDomain = 'https://archive.today' } = args;

  /** Internal */
  let { submitid } = args;
  const { referer } = args;

  const headers = {};
  if (userAgent) headers['user-agent'] = userAgent;
  if (referer) headers.referer = referer;

  // Get an initial submitid from the index page, as well as follow the redirect for the desired mirror to be used.
  // This step is not performed when renewing.
  const passedSubmitid = submitid;
  if (!submitid) {
    const indexPage = await fetch(archiveDomain, { headers });
    const body = await indexPage.text();
    archiveDomain = indexPage.url;
    submitid = extractSubmitid(body);
  }

  const body =
    (passedSubmitid ? 'anyway=1&' : '') +
    'url=' +
    encodeURIComponent(url) +
    '&submitid=' +
    encodeURIComponent(submitid);

  let response = await fetch(
    `${archiveDomain}${archiveDomain.endsWith('/') ? '' : '/'}submit/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body,
      redirect: 'manual',
    }
  );
  let link = '';
  let wip = false;
  let cachedDate = false;

  if (response.status === 200) {
    const responseText = await response.text();
    if (responseText === '<h1>Invalid URL</h1>') {
      throw new TypeError('Invalid URL sent to archive.today: ' + url);
    }

    link = response.headers.get('refresh').split('url=')[1];

    if (link.includes('/wip/')) {
      if (complete) {
        while (true) {
          const res = await fetch(link, {
            headers,
            redirect: 'manual',
          });
          const redirect = res.headers.get('location');
          if (redirect) {
            link = redirect;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } else {
        wip = link;
        link = link.replace('/wip/', '/');
      }
    }
  } else if (response.status === 302 || response.status === 307) {
    // Found
    link = response.headers.get('location');
    response = await fetch(link, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body,
      redirect: 'manual',
    });
    cachedDate = new Date(response.headers.get('memento-datetime'));

    // Already archived, re-submit with submitid and referer from the page (this is required)
    if (!passedSubmitid) {
      const renewing =
        typeof renew === 'function' ? await renew(cachedDate) : Boolean(renew);
      if (renewing) {
        const renewSubmitid = extractSubmitid(await response.text());
        return snapshot({
          ...args,
          userAgent, // Re-use the same user agent (if it was generated)
          archiveDomain,
          submitid: renewSubmitid,
          referer: link,
        });
      }
    }
  } else {
    throw new Error('Unknown response code: ' + response.status);
  }

  // _ and __ are the // in the protocol
  const [_, __, domain, id] = link.split('/');
  return { id, url: link, domain, image: `${link}/scr.png`, cachedDate, wip };
};

function extractSubmitid(html) {
  return html.match(/<input type="hidden" name="submitid" value="(.*?)"\/>/)[1];
}

exports.timemap = async function timemap({
  url,
  userAgent = new UserAgent().toString(),
  archiveDomain = 'https://archive.today',
}) {
  const rawMap = await fetch(`${archiveDomain}/timemap/${url}`, {
    headers: userAgent
      ? {
          'User-Agent': userAgent,
        }
      : {},
  }).then((r) => r.text());

  const mementoMap = rawMap.split(',\n');
  const mementos = [];

  // No mementos (never been archived)
  if (!mementoMap[0].includes('rel="original"')) {
    return mementos;
  }

  for (const line of mementoMap) {
    const [url, rel, datetime] = line.split('; ');
    if (rel.includes('memento')) {
      // Remove < and >
      mementos.push({
        url,
        date: new Date(datetime.slice(datetime.indexOf('"'), datetime.lastIndexOf('"'))),
      });
    }
  }

  return mementos;
};
