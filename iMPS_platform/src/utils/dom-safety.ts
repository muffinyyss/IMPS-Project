/**
 * Protection contre le crash React « NotFoundError: Failed to execute
 * 'removeChild' on 'Node' » provoqué par Google Translate (et extensions
 * similaires) qui déplacent les nœuds texte gérés par React dans des <font>.
 * Quand le DOM a été modifié en dehors de React, removeChild/insertBefore
 * échouent — on retombe alors sur un no-op au lieu de faire planter l'app.
 * Pattern standard, cf. bug React #11538.
 */
let installed = false;

export function installDomSafetyPatch() {
    if (installed || typeof Node !== "function" || !Node.prototype) return;
    installed = true;

    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
        if (child.parentNode !== this) {
            console.warn("[dom-safety] removeChild ignoré : le nœud a été déplacé (traduction de page ?)", child);
            return child;
        }
        return originalRemoveChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
        if (referenceNode && referenceNode.parentNode !== this) {
            console.warn("[dom-safety] insertBefore dégradé en appendChild : nœud de référence déplacé (traduction de page ?)", referenceNode);
            return this.appendChild(newNode) as T;
        }
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
    };
}
