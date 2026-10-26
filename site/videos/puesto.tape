# El puesto de trabajo: bond abre fluzo en Herdr con gru (pi), le preguntamos algo y miramos bond status.
Output puesto.mp4
Set Shell "bash"
Set FontSize 15
Set Width 1400
Set Height 820
Set Padding 16
Set TypingSpeed 40ms
Set Theme "Catppuccin Mocha"

Hide
Type "herdr --session bond-demo"
Enter
Sleep 4s
Type "source /tmp/bond-demo/tapes/bond-fn.zsh && cd /tmp/bond-demo/fluzo && clear"
Enter
Sleep 1s
Show

Type "bond"
Enter
Sleep 7s
# pi pregunta si confías en la carpeta: es un repo de demo, así que sí
Enter
Sleep 6s
Type "¿De qué va este repo? Respóndeme en dos frases."
Sleep 500ms
Enter
Sleep 4s
Hide
Sleep 40s
Show
Sleep 3s
# Una shell al lado para ver el estado de los agentes
Ctrl+B
Type "v"
Sleep 2s
Type "bond status"
Enter
Sleep 6s
