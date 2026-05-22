import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const ENGINE_CONFIGS = {
  apibay:       require('./apibay.json'),
  limetorrents: require('./limetorrents.json'),
  yts:          require('./yts.json'),
  solid:        require('./solid.json'),
  nyaa:         require('./nyaa.json'),
  '1337x':      require('./1337x.json'),
  torrentz2:    require('./torrentz2.json'),
  kickass:      require('./kickass.json'),
  fitgirl:      require('./fitgirl.json'),
  torrent9:     require('./torrent9.json'),
  oxtorrent:    require('./oxtorrent.json'),
};
