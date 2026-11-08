// Composes the concept-sheet prompt for one character sheet ("ficha"). The ficha says WHO
// (identity, outfit, measured body, what not to exaggerate, references); this prompt says
// HOW (rig pose, cast style and proportions) and is shared by every character. The cast
// style image is always the last image sent, after `referenceCount` identity references.
export function composeCharacterConceptPrompt(ficha, { referenceCount = 0 } = {}) {
  for (const field of ['id', 'identidade', 'roupa', 'corpo']) {
    if (typeof ficha?.[field] !== 'string' || !ficha[field].trim()) throw new Error(`ficha is missing "${field}"`);
  }
  // `especie` (for example "plush mascot creature") replaces the adult human and the 1/7
  // head canon, so it must come with explicit `proporcao`: a creature without proportions
  // turns into a costumed human in the concept and then in the 3D model.
  if (ficha.especie && !ficha.proporcao) throw new Error(`ficha ${ficha.id}: especie without proporcao`);
  const who = ficha.especie ? `ONE ${ficha.especie}` : ficha.genero === 'f' ? 'ONE adult woman' : 'ONE adult man';
  const castImage = referenceCount + 1;
  return [
    `Character concept sheet for a stylized 3D third-person shooter. ${who}, full body, front view, symmetric T-pose (arms straight out horizontally, palms down, fingers slightly apart, hands EMPTY), feet shoulder-width apart flat on the ground, plain flat light-grey background, no text, no props, no weapon, no shadow on the background.`,
    '',
    `IDENTITY${referenceCount ? ` (from the photo references, images 1 to ${referenceCount})` : ''}: ${ficha.identidade}`,
    // Without photo references the character is original: image models tend to complete a
    // famous archetype with the face of whoever popularised it, which the veto forbids.
    // `dominioPublico` (historical figure or public-domain work) swaps the lock: period
    // public-domain iconography is allowed, never a modern actor's portrayal.
    referenceCount ? null : ficha.dominioPublico
      ? `PUBLIC-DOMAIN FIGURE (${ficha.dominioPublico}): base the look only on public-domain sources of that period, NOT on any modern film, TV or game actor's portrayal or costume design.`
      : 'ORIGINAL CHARACTER: an invented face and design, NOT a portrait or likeness of any real person, actor, musician or TV personality, and NOT a copy of any existing film, TV, comic or game character.',
    '',
    `OUTFIT: ${ficha.roupa}`,
    '',
    `BODY (${referenceCount ? 'measured on photos' : 'from the character sheet'}, the most important part): ${ficha.corpo}`,
    ficha.naoExagerar ? `Do NOT exaggerate: ${ficha.naoExagerar}. Respectful caricature only in the face and the signature accessory.` : '',
    '',
    ficha.especie
      ? `STYLE (image ${castImage} is the existing game cast — match its rendering exactly): the same stylized-realistic 3D game look as the characters in image ${castImage}: clean readable shapes, smooth PBR materials, soft matte surfaces. PROPORTIONS: ${ficha.proporcao} Arms and hands able to hold a rifle, real feet or shoes.`
      : `STYLE (image ${castImage} is the existing game cast — match it exactly): the same stylized-realistic 3D game look as the characters in image ${castImage}: clean readable shapes, smooth PBR materials, soft matte fabric, natural adult anatomy. Same head-to-body ratio as those characters (head about 1/7 of total height, NOT a bobblehead, NOT chibi, NOT Pixar), natural neck length, natural shoulders, arms and hands in proportion, real feet.`,
    '',
    'Matte materials, no glossy white highlights, no rim glow, no outline.',
  ].filter(line => line !== null).join('\n');
}
