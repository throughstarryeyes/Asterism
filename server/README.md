# Sync server

A small reference server for Asterism sync, and a starting point if you host your own. It keeps one JSON file per project, checks a bearer token, and uses ETags so two devices can't overwrite each other by accident.

```
ASTERISM_TOKEN=secret node server/sync-server.mjs            # port 8787, data in ./sync-data
PORT=9000 DATA_DIR=/var/lib/asterism node server/sync-server.mjs
```

Put HTTPS in front of it (a reverse proxy) for anything beyond your own machine.

## Projects

| Request | Result |
| --- | --- |
| `GET /projects/:id` | 200 with an ETag, or 404 |
| `PUT /projects/:id` with `If-None-Match: *` | create (412 if it exists) |
| `PUT /projects/:id` with `If-Match: <etag>` | replace (412 if it changed) |

## Files

Uploaded fonts, pictures and recordings are stored beside the project, one file each.

| Request | Result |
| --- | --- |
| `GET /projects/:id/assets` | 200 with a JSON list of `{id, kind, type, size, family?, fileName?}` (kind: font, image, sound or extras) |
| `GET /projects/:id/assets/:asset` | the file, or 404 |
| `PUT /projects/:id/assets/:asset` | the file as the body, described in the `X-Asset-Meta` header (URL-encoded JSON) |
| `DELETE /projects/:id/assets/:asset` | the file is cleared (200 even if it was already gone) |

Files are never overwritten, except the one with id `extras` (the writer's themes and sounds), which is replaced.

# Session relay (live writing together)

`session-relay.mjs` is what a host runs to write together live. It only passes bytes between the host and the guests. Everything is scrambled with the invite password, which the relay never sees, so it cannot read the writing, and neither can a tunnel in front of it.

```
node server/session-relay.mjs                 # port 8788; prints a host key
PORT=9000 ASTERISM_HOST_KEY=my-own-key node server/session-relay.mjs
```

1. The host starts the relay and puts the host key into Asterism. Only the host needs the key.
2. The host makes an invite and gives the guest the host's address and the invite's password (four words). An invite works once and runs out after 15 minutes.
3. The guest types the address and the password.

**Reaching the host.** On the same network, the address is the host's local one, such as `192.168.1.20:8788`. Over the internet, the host points their own tunnel at the relay, for example `cloudflared tunnel --url http://localhost:8788`, and gives guests the address it prints. Nobody else hosts anything.

The relay slows down repeated wrong guesses, allows up to 8 guests, and drops everyone when the host leaves.

A guest whose connection drops comes back on their own: once in, the host gives them a one-time rejoin ticket (the relay only sees its hash, and the host can ask for it to last up to 12 hours), and they use it to rejoin and are handed a new one. The relay pings every connection and closes ones that have gone silent, so a lost connection is noticed and can be replaced.
