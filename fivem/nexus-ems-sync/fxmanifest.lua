-- FiveM's resource manifest — this file has to be Lua; the resource itself is
-- JavaScript (server.js, client.js, config.js) and needs nothing installed.
fx_version 'cerulean'
game 'gta5'

name 'nexus-ems-sync'
author 'Nexus EMS'
description 'Links the city to the Nexus EMS website: duty sync, unit statuses, in-game call logging and live presence.'
version '1.1.0'

shared_script 'config.js'
server_script 'server.js'
client_script 'client.js'
