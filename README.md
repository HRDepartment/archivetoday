# archivetoday

Unofficial API and CLI for archive.today. Supports creating/fetching snapshots and listing all the snapshots of a URL.

![npm](https://img.shields.io/npm/v/archivetoday)

## API

```ts
export interface SnapshotOptions {
  /**
   * URL to snapshot
   */
  url: string;
  /**
   * `archive.today` mirror to contact initially. Note that archive.today commonly redirects to a different mirror, so this does not guarantee that the result will use this domain.
   * @default "https://archive.today"
   */
  archiveDomain?: string;
  /**
   * @default "[A random user agent from the 'user-agents' package]"
   */
  userAgent?: string;
  /**
   * Ask archive.today to renew its archive of this page. Requires a browser-like UA.
   * If a function is passed, you can choose to conditionally renew based on the date of the cached snapshot, such as if it's a few weeks old.
   * @default false
   */
  renew?: boolean | ((cachedDate: Date) => boolean | Promise<boolean>);
  /**
   * Whether to wait for archiving to finish. If set to false, `wip` will be set with a link that tracks progress and redirects upon completion. Ignored if an existing archive is returned.
   * @default true
   */
  complete?: boolean;
}

export interface SnapshotResult {
  /**
   * ID of the returned snapshot link.
   * @example 3B03B
   */
  id: string;
  /**
   * Domain used for the returned link
   * @example "archive.vn"
   */
  domain: string;
  /**
   * Link to the archived snapshot
   * @example https://archive.vn/3B03B
   */
  url: string;
  /**
   * Link to the screenshot of the snapshot
   * @example https://archive.vn/3B03B/scr.png
   */
  image: string;
  /**
   * If this page is cached, this will be a Date of when it was archived. This is `false` when first archiving and when renewing the page.
   */
  cachedDate?: false | Date;
  /**
   * If the snapshot is being archived (complete must have been set to false), this will be the URL pointing to the WIP page.
   * @example https://archive.vn/wip/3B03B
   */
  wip?: false | string;
}

export interface TimemapOptions {
  /**
   * URL to request a timemap for. Will do an exact match except for protocol; this includes query parameters, which you might want to strip beforehand if you do not intend to search for them specifically.
   */
  url: string;
  /**
   * `archive.today` mirror to contact initially. Note that archive.today commonly redirects to a different mirror, so this does not guarantee that the result will use this domain.
   * @default "https://archive.today"
   */
  archiveDomain?: string;
  /**
   * @default "[A random user agent from the 'user-agents' package]"
   */
  userAgent?: string;
}

export interface TimemapMemento {
  url: string;
  date: Date;
}

/**
 * Sorted oldest to newest
 */
export type TimemapResult = TimemapMemento[];

/**
 * Asks archive.today to create or return the latest snapshot for a given URL.
 * @throws If there is a captcha or if the input is invalid.
 */
export declare function snapshot(options: SnapshotOptions): Promise<SnapshotResult>;
/**
 * Retrieves a listing of all snapshots of a given URL on archive.today
 */
export declare function timemap(options: TimemapOptions): Promise<TimemapResult>;
```

### Examples

```ts
import { snapshot, timemap } from 'archivetoday';

// cachedDate will be set if a previous snapshot is returned
const { url, cachedDate } = await snapshot({ url: 'https://example.com' });
// array of { url, date }
const urls = await timemap({ url: 'example.com' });

// Don't wait for the initial saving to finish (wip will be set if it's in progress)
// cachedDate will be set if a previous snapshot is returned
const { url, wip, cachedDate } = await snapshot({
  url: 'https://example.com',
  complete: false,
});

// Attempts to create a new snapshot. cachedDate can still be set if a snapshot was very recently created (archive.today has a ratelimit per url of about an hour).
const { url, cachedDate } = await snapshot({ url: 'https://example.com', renew: true });

// Create a snapshot or force re-archival without waiting.
const { url, wip, cachedDate } = await snapshot({
  url: 'https://example.com',
  renew: true,
  complete: false,
});

// Renew only if the snapshot is older than a week.
const { url } = await snapshot({
  url: 'https://example.com',
  renew(cachedDate) {
    return new Date().getTime() - cachedDate.getTime() > 1000 * 60 * 60 * 24 * 7;
  },
});
```

## CLI examples

This package also comes with a CLI, which is primarily useful when installing globally.

```sh
$ archivetoday example.com # Returns a snapshot link and the date
$ archivetoday --renew example.com # Asks archive.today to create a new snapshot (aka -r)
$ archivetoday --quiet example.com # Only returns the URL, useful for scripting (aka -q)
$ archivetoday --incomplete example.com/notfound # Returns the archive link immediately without waiting for the process to complete. Especially useful with -q. (aka -c)
$ archivetoday -rc example.com # Re-archive a link, without waiting (renew and incomplete)
$ archivetoday timemap microsoft.com # Returns all archive links for a url
```

## License

MIT
