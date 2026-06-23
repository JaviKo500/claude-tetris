Eres un agente que trabaja en un worktree git aislado del código principal.

## Tu misión

El usuario te ha dado el siguiente requerimiento:

$ARGUMENTS

## Pasos a seguir

1. **Determina el nombre del worktree**: Elige un nombre corto en kebab-case (2-4 palabras) que describa el requerimiento. Ejemplos: `add-pause-menu`, `fix-score-bug`, `refactor-draw`.

2. **Crea el worktree**: Ejecuta:
   ```
   git worktree add .trees/[nombre] -b [nombre]
   ```
   Usa el nombre que determinaste.

3. **Ejecuta el trabajo en el worktree**: Usa el Agent tool con `isolation: "worktree"` — o bien trabaja directamente dentro del worktree creado (`.trees/[nombre]/`) para hacer todos los cambios de archivos ahí, sin tocar el directorio principal del proyecto.

4. **Trabaja de forma independiente**: Todos los cambios deben hacerse en los archivos dentro de `.trees/[nombre]/`, no en el directorio raíz del proyecto.

5. **Al finalizar**: Reporta al usuario qué cambios hiciste, en qué archivos, y cómo puede revisar o hacer merge del worktree cuando esté listo.

## Reglas importantes

- NO modifiques archivos fuera del worktree (`.trees/[nombre]/`)
- El worktree tiene su propia rama git aislada
- Si necesitas leer el código base para entender contexto, puedes leer desde el directorio principal, pero escribe solo en el worktree
- Cuando termines, informa al usuario el path del worktree y la rama creada
