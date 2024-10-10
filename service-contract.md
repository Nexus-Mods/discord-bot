Adheres to [service contract v1.](https://gitlab.nexdev.uk/nexus-mods/service-docs/-/blob/v1/service-contract.md)

## Overview

| Tier | Owners                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------- |
| 2    | [Rory Clark](https://gitlab.nexdev.uk/roryclark), [Ben Gosney](https://gitlab.nexdev.uk/bengosney) |


## Endpoints

| Endpoint                         | Format    | Audience | Use                               |
| -------------------------------- | --------- | -------- | --------------------------------- |
| https://discordbot.nexusmods.com | html      | Public   | Status page, docs, oauth callback |
| Discord                          | websocket | Public   | comunication with discord         |

## Service Description

- Provides means to link nexus account and discord acounts
- Search for
  - mods
  - collections
  - users
- Game Feeds - post new and updated mods for noimated games
- Lookup nexus mods accounts by discord user

- Auto modarator
  - Compares new mods every against known spam and sends alert
  

## Connections

This service connects to the following:

| Service         | HA                 | SSL                | Notes                                 | Consequence of failure              | Consequence tested? |
| --------------- | ------------------ | ------------------ | ------------------------------------- | ----------------------------------- | ------------------- |
| DigitalOcean DB | :warning:          | :white_check_mark: | Database responsible for all writes   | Service outage :fire:               | Yes                 |
| Discord         | :white_check_mark: | :white_check_mark: | If discord is down, no one can access | None                                | No                  |
| BackBlaze       | :white_check_mark: | :white_check_mark: | Access games.json                     | Search and game feeds will not work | Yes                 |

Internal connections:

| Service     | HA                 | Notes                                          | Consequence of failure | Consequence tested? |
| ----------- | ------------------ | ---------------------------------------------- | ---------------------- | ------------------- |
| Users       | :white_check_mark: |                                                | Pod would restart      | No                  |
| API         | :white_check_mark: | Used to pull application secrets on deployment |                        | No                  |
| staticstats | :white_check_mark: | Game downloads                                 | No mod download stats  | No                  |

## Backups

Follows our backup strategy.
Daily copies to the office can be reviewed on
the backup dashboard.
Resources that are backed up:

DigitalOcean DB - All tables

### Disaster recovery

None

#### Effect of service being down

- Auto modarator would not work
- Game feeds would not work
- Account linking would not work

#### Time to recover

The recovery process is manual. Note that minimally restoring service refers to having the service available, but does
not include dealing with post recovery data loss.

> **TODO:** Document the time to recover - this usually is an estimate, as well as the average storage size.

| Data lost | Time to minimally restore service | Backup size |
| --------- | --------------------------------- | ----------- |
| xxx       | xxx                               | xxx         |

TODO(BG/RC): Trial run of disaster recovery process.


#### Post recovery data loss

Everything

## SLA Checks

### Monitoring

None

