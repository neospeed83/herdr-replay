#!/usr/bin/env node
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { installBinding, removeBinding, shortcut } from "./config.mjs";

function configPath(){if(process.platform==="win32"){if(!process.env.APPDATA)throw new Error("APPDATA is unavailable.");return join(process.env.APPDATA,"herdr","config.toml")}const base=process.env.XDG_CONFIG_HOME||join(process.env.HOME||"",".config");if(!base)throw new Error("Cannot locate Herdr config.toml.");return join(base,"herdr","config.toml")}
const path=configPath(),source=existsSync(path)?readFileSync(path,"utf8"):"",mode=process.argv[2]||"install";
const result=mode==="remove"?removeBinding(source):installBinding(source);
if(result.changed){mkdirSync(dirname(path),{recursive:true});if(existsSync(path)){try{copyFileSync(path,`${path}.bak-herdr-replay`,constants.COPYFILE_EXCL)}catch(error){if(error.code!=="EEXIST")throw error}}writeFileSync(path,result.content,"utf8")}
process.stdout.write(mode==="remove"?(result.changed?`Removed ${shortcut}.\n`:"Replay keybinding was not present.\n"):(result.changed?`Installed ${shortcut}.\n`:`${shortcut} is already installed.\n`));
