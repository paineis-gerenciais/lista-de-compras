/**
 * Categorização automática — bloco B4 da Fase 3, portado para TypeScript.
 *
 * O dicionário reflete o *trajeto do mercado brasileiro*, não a taxonomia do
 * produto. Por isso leite condensado está em Mercearia (corredor seco, perto
 * da confeitaria) e não com os refrigerados — foi um bug real corrigido na
 * Fase 3, e o teste que o pegou continua valendo.
 */

const GRUPOS: Record<string, string[]> = {
    'Hortifruti': ['alface','tomate','cebola','alho','batata','batata doce','cenoura','beterraba','abobrinha','abobora','chuchu','pepino','pimentao','brocolis','couve','couve flor','repolho','espinafre','rucula','agriao','salsinha','cebolinha','coentro','manjericao','hortela','gengibre','mandioca','aipim','inhame','quiabo','vagem','ervilha fresca','milho verde','berinjela','rabanete','nabo','abacate','abacaxi','banana','laranja','limao','maca','mamao','manga','melancia','melao','morango','pera','pessego','uva','goiaba','kiwi','tangerina','mexerica','maracuja','caju','acerola','ameixa','coco','figo','jaca','carambola','cereja','framboesa','mirtilo','pinha','graviola','cacho de banana','salada','tempero verde','cogumelo','champignon'],
    'Açougue': ['carne','carne moida','patinho','acem','alcatra','picanha','maminha','fraldinha','coxao mole','coxao duro','musculo','costela','file mignon','contra file','bife','frango','peito de frango','coxa','sobrecoxa','asa de frango','file de frango','frango inteiro','peru','chester','linguica','linguica toscana','linguica calabresa','calabresa','bacon','toucinho','carne seca','charque','costelinha','lombo','pernil','porco','carne de porco','pancetta','peixe','tilapia','salmao','sardinha','merluza','bacalhau','camarao','polvo','lula','pescada','atum fresco','carne para churrasco','picadinho','moela','figado','coracao'],
    'Frios e Laticínios': ['leite','leite integral','leite desnatado','iogurte','queijo','mussarela','muçarela','prato','minas','ricota','requeijao','catupiry','parmesao','provolone','gorgonzola','cheddar','manteiga','margarina','presunto','mortadela','salame','peito de peru','apresuntado','nata','coalhada','leite fermentado','danone','petit suisse','queijo coalho','cream cheese','iogurte natural'],
    'Mercearia': ['arroz','feijao','feijao preto','feijao carioca','lentilha','grao de bico','soja','macarrao','espaguete','penne','parafuso','talharim','lasanha','nhoque','farinha','farinha de trigo','farinha de mandioca','farofa','fuba','polvilho','amido de milho','maisena','leite condensado','creme de leite','acucar','acucar refinado','acucar mascavo','adocante','sal','oleo','oleo de soja','azeite','vinagre','molho de tomate','extrato de tomate','ketchup','mostarda','maionese','shoyu','molho ingles','pimenta','pimenta do reino','oregano','cominho','colorau','paprica','canela','cravo','louro','noz moscada','tempero pronto','caldo de galinha','sazon','fermento','fermento em po','bicarbonato','gelatina','pudim','achocolatado','nescau','toddy','cafe','po de cafe','filtro de cafe','cha','cha mate','erva mate','chimarrao','leite em po','aveia','granola','cereal','sucrilhos','biscoito','bolacha','bolacha recheada','cream cracker','maisena bolacha','torrada','salgadinho','batata frita','amendoim','castanha','castanha de caju','castanha do para','nozes','uva passa','coco ralado','leite de coco','doce de leite','geleia','mel','nutella','creme de avela','chocolate','barra de chocolate','bombom','bala','chiclete','pipoca','milho de pipoca','atum','sardinha em lata','milho em conserva','ervilha em lata','seleta de legumes','palmito','azeitona','champignon em conserva','molho branco','sopa','miojo','macarrao instantaneo','tapioca','cuscuz','farinha de rosca','proteina de soja','massa de pastel','massa de lasanha'],
    'Padaria': ['pao','pao frances','pao de forma','pao integral','pao de queijo','baguete','ciabatta','bisnaguinha','croissant','sonho','bolo','bolo de chocolate','rosca','broa','torta','panetone','pao doce','pao sirio','pao de hamburguer','pao de hot dog','pao de leite','folhado','empada','salgado','coxinha','esfiha','pastel'],
    'Bebidas': ['agua','agua mineral','agua com gas','refrigerante','coca cola','guarana','fanta','sprite','suco','suco de laranja','suco em po','tang','nectar','refresco','cerveja','vinho','vinho tinto','vinho branco','espumante','vodka','cachaca','whisky','gin','rum','licor','energetico','isotonico','gatorade','red bull','agua de coco','cha gelado','chopp','tonica','soda'],
    'Limpeza': ['detergente','sabao','sabao em po','sabao liquido','amaciante','vanish','agua sanitaria','cloro','desinfetante','pinho sol','veja','multiuso','limpa vidro','limpador','lustra moveis','cera','alcool','alcool em gel','esponja','esponja de aco','bombril','pano de chao','pano de prato','rodo','vassoura','balde','saco de lixo','papel toalha','luva de borracha','tira manchas','desengordurante','limpa forno','sabao de coco','odorizador','inseticida','naftalina','desodorizador'],
    'Higiene': ['papel higienico','sabonete','shampoo','condicionador','creme','creme hidratante','pasta de dente','creme dental','escova de dente','fio dental','enxaguante bucal','listerine','desodorante','antitranspirante','absorvente','protetor diario','fralda','lenco umedecido','algodao','cotonete','barbeador','gilete','espuma de barbear','protetor solar','repelente','hidratante','oleo corporal','talco','perfume','cotonetes','curativo','band aid','remedio','dipirona','paracetamol','ibuprofeno','vitamina','soro fisiologico','mascara facial','tintura de cabelo','condicionador infantil'],
    'Bebê e Pet': ['fralda descartavel','lencinho','papinha','formula infantil','mamadeira','chupeta','pomada assadura','racao','racao de cachorro','racao de gato','areia de gato','petisco','osso','sache pet','shampoo pet','antipulgas'],
    'Outros': ['pilha','bateria','lampada','carvao','fosforo','isqueiro','guardanapo','papel aluminio','papel manteiga','filme plastico','pote plastico','copo descartavel','prato descartavel','talher descartavel','vela','fita adesiva','cola','caneta','caderno','papel','tomada','extensao','cabo','carregador']
  }

export const CATEGORIAS_PADRAO = Object.keys(GRUPOS);

/** Índice invertido: termo normalizado -> categoria. */
const DICIONARIO: Record<string, string> = (() => {
  const d: Record<string, string> = {};
  for (const cat of Object.keys(GRUPOS)) {
    for (const termo of GRUPOS[cat] ?? []) d[normalizeName(termo)] = cat;
  }
  return d;
})();

export function stripAccents(s: string): string {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeName(s: string): string {
  return stripAccents(String(s ?? '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function titleCaseFirst(s: string): string {
  const t = String(s ?? '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Casa primeiro o nome inteiro, depois n-gramas do maior para o menor, e só
 * então tenta plural. Sem essa ordem, "peito de frango" cairia em Outros por
 * causa da palavra isolada "peito".
 *
 * `conhecidos` traz as escolhas anteriores do próprio usuário: se ele já
 * classificou algo à mão, a decisão dele vale mais que o dicionário.
 */
export function guessCategory(name: string, conhecidos?: Record<string, { category?: string }>): string {
  const n = normalizeName(name);
  if (!n) return '';
  if (DICIONARIO[n]) return DICIONARIO[n]!;

  const palavras = n.split(' ');
  for (let tam = Math.min(3, palavras.length); tam >= 1; tam--) {
    for (let i = 0; i + tam <= palavras.length; i++) {
      const gram = palavras.slice(i, i + tam).join(' ');
      if (DICIONARIO[gram]) return DICIONARIO[gram]!;
    }
  }

  for (const p of palavras) {
    if (p.length > 3 && p.endsWith('s')) {
      const sing = p.slice(0, -1);
      if (DICIONARIO[sing]) return DICIONARIO[sing]!;
    }
  }

  const previo = conhecidos?.[n];
  if (previo?.category) return previo.category;
  return '';
}
