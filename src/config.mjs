export const shortcut = "prefix+f";
export const bindingBlock = `[[keys.command]]
key = "${shortcut}"
type = "plugin_action"
command = "herdr-replay.toggle"
description = "toggle Herdr Replay recording"`;

export function installBinding(source) {
  if (/command\s*=\s*["']herdr-replay\.toggle["']/.test(source)) return { content:source, changed:false };
  const conflict = /\[\[keys\.command\]\][\s\S]*?key\s*=\s*["']prefix\+f["'][\s\S]*?(?=\n\[\[|$)/m.test(source);
  if (conflict) throw new Error("prefix+f is already assigned; Herdr Replay did not overwrite it.");
  const trimmed=source.trimEnd();
  return { content:`${trimmed}${trimmed?"\n\n":""}${bindingBlock}\n`, changed:true };
}

export function removeBinding(source) {
  const escaped=bindingBlock.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const content=source.replace(new RegExp(`(?:^|\\n\\n)${escaped}\\n?`,"m"),m=>m.startsWith("\n\n")?"\n":"");
  return { content, changed:content!==source };
}
