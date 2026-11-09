# Enderlørd City Bots - a1 b2 c3 d4 e5

5 bots that stay together and build a modern city, parks and rides on your server:
skyscrapers, modern houses, observation tower, parks with ponds/trees/benches, fountain plazas,
ferris wheel, carousel, roads with lamps.

## IMPORTANT: they never break blocks
No digging, no chopping. They build only with `/fill ... keep` and `/setblock ... keep`
(keep = only AIR gets replaced). Before building a plot they also check the ground: uneven or already
built-on plots are skipped.

## Setup
1. Aternos: start server, whitelist off (or add a1..e5), then in the console: `op a1`, `op b2`, `op c3`, `op d4`, `op e5`
   (bots need OP for /fill, /tp, /gamemode).
2. Go to a FLAT, EMPTY area of your world (a big flat field is best). Start the bots when they spawn there,
   OR set `city` x/y/z in `settings.json`. The spawn point of the first bot becomes the city center.
3. `npm install` then `npm start` (bots join 20s apart).

## Commands in chat (settings.json -> owners = your Minecraft name)
- `a1 city here` - move the city center to where you stand (owner only)
- `a1 stop` / `a1 go` - pause / resume that bot
- `a1 status` - what it is doing
- anything else -> answers with Gemini (optional, needs GEMINI_API_KEY in .env)

## Roles (bots.json)
a1 skyline (skyscrapers, houses) - b2 gardener (parks, fountain) - c3 rides (ferris wheel, carousel) -
d4 landmark (towers, skyscrapers) - e5 mixed (everything).

State is shared in `shared/city.json` so bots never build on the same plot. Delete that folder to restart the city.
Never upload `.env` to GitHub.
