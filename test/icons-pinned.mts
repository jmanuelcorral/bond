// Preload de `bun test`: fija el estilo de iconos a emojis para que las aserciones sobre las
// tablas no dependan de si la máquina del que ejecuta tiene o no una Nerd Font instalada y lo
// puso en [ui] icons. BOND_ICONS puesta fuera gana, así que se puede pasar BOND_ICONS=nerd (o
// =unicode) para ver la suite entera con ese juego de iconos.

process.env.BOND_ICONS = process.env.BOND_ICONS ?? "emoji";
