#!/usr/bin/env node --unhandled-rejections=strict

'use strict';

const help = `
archivetoday --help  Show this message
archivetoday [options] [url]  Ask archive.today to snapshot a URL.
archivetoday timemap [url]  List past snapshots of a URL on archive.today.

Options:
  --quiet, -q  Only output the URL.
  --renew, -r  Ask archive.today to re-archive the link. If the link was archived too recently (roughly within the past hour), this will be ignored.
  --incomplete, -c  Don't wait for archiving to complete, and instead return the URL (that will work shortly) as soon as possible.
  --domain [default=https://archive.today]  Domain mirror to use (such as archive.vn). Note that in most cases archive.today will assign a mirror itself.
  --user-agent  User agent override. Uses a random user agent from the user-agents package by default (https://npmjs.com/package/user-agents). Without a user agent, things like renewing won't work.
`;

const argv = require('minimist')(process.argv.slice(2), {
  alias: {
    quiet: ['q'],
    help: ['h'],
    renew: ['r'],
    incomplete: ['c'],
  },
  default: {
    domain: 'https://archive.today',
  },
  boolean: ['quiet', 'renew', 'incomplete', 'help'],
});

const { snapshot, timemap } = require('..');

async function main() {
  if (argv.help) {
    console.log(help);
    return;
  }

  let mode = 'snapshot';
  if (argv._[0] === 'timemap') {
    mode = 'timemap';
    argv._ = argv._.slice(1);
  }

  const url = argv._.join(' ');
  const requestOptions = {
    url,
    userAgent: argv['user-agent'],
    archiveDomain: argv.domain || 'https://archive.today',
  };

  if (mode === 'snapshot') {
    if (!argv.quiet) {
      console.log(`Snapshotting ${url}...`);
    }

    const { url: snapshotUrl, wip, cachedDate } = await snapshot({
      ...requestOptions,
      renew: argv.renew,
      complete: !argv.incomplete,
    });
    if (argv.quiet) {
      console.log(snapshotUrl);
    } else {
      console.log('');
      console.log(`Snapshot: ${snapshotUrl}`);
      if (wip) {
        console.log(`WIP: ${wip}`);
      }

      if (cachedDate) {
        console.log(`Originally saved at ${cachedDate}`);
        console.log('');
        console.log(
          `- Re-invoke this command with the --renew flag to ask archive.today to archive the present version of your link.`
        );
      }
    }
  } else if (mode === 'timemap') {
    const mementos = await timemap(requestOptions);
    if (mementos.length === 0) {
      console.error(`${url} has not been archived yet.`);
      process.exit(1);
    }

    for (const { url: mementoUrl, date } of mementos) {
      console.log(`${date}: ${mementoUrl}`);
    }
  }
}

main();
