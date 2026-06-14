import { Peer } from 'peerjs';
import { RemotePeers } from './RemotePeers.js';

// Multijoueur pair-à-pair via WebRTC (broker public PeerJS). L'hôte fait
// autorité sur le monde : il envoie un instantané (seed + modifications +
// coffres + heure) aux nouveaux venus, simule les mobs et diffuse l'heure. Tout
// le monde diffuse sa position et ses modifications de blocs (relayées par
// l'hôte aux autres). Topologie en étoile autour de l'hôte.
export class Network {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.conns = new Map(); // peerId -> DataConnection
    this.isHost = false;
    this.id = null;
    this.remote = new RemotePeers(game.scene, game.material);
    this._posTimer = 0;
    this._timeTimer = 0;
    this._mobTimer = 0;
  }

  // --- Connexion ------------------------------------------------------------

  host(worldMeta) {
    this.isHost = true;
    this._createPeer(
      (id) => {
        this.game.menu.setHostInfo(
          `Salon ouvert ! Code : <code>${id}</code><br>Partage ce code. En attente de joueurs…`
        );
        this.game.loadWorld(worldMeta); // l'hôte joue son monde localement
        this.game.world.onEdit = (x, y, z, bid) => this.broadcast({ t: 'block', x, y, z, id: bid });
      },
      (err) => this.game.menu.setHostInfo(`Erreur de connexion au broker : ${err}`)
    );
    this.peer.on('connection', (conn) => this._setupConn(conn));
  }

  join(code) {
    this.isHost = false;
    this._createPeer(
      () => {
        const conn = this.peer.connect(code.trim(), { reliable: true });
        conn.on('open', () => {
          this._setupConn(conn);
          conn.send({ t: 'hello' });
          this.game.menu.setJoinInfo('Connecté ! Réception du monde…');
        });
        conn.on('error', (e) => this.game.menu.setJoinInfo(`Connexion impossible : ${e}`));
      },
      (err) => this.game.menu.setJoinInfo(`Erreur de connexion au broker : ${err}`)
    );
  }

  _createPeer(onOpen, onErr) {
    this.peer = new Peer();
    this.peer.on('open', (id) => { this.id = id; onOpen(id); });
    this.peer.on('error', (e) => onErr(e.type || e.message || String(e)));
  }

  _setupConn(conn) {
    this.conns.set(conn.peer, conn);
    conn.on('data', (msg) => this._onData(conn, msg));
    conn.on('close', () => { this.conns.delete(conn.peer); this.remote.removePlayer(conn.peer); });
  }

  // --- Messages -------------------------------------------------------------

  _onData(conn, msg) {
    const g = this.game;
    switch (msg.t) {
      case 'hello':
        if (this.isHost) conn.send(this._snapshot());
        break;

      case 'snapshot':
        this._applySnapshot(msg);
        break;

      case 'block':
        g.world._suppressEdit = true;
        g.world.setBlock(msg.x, msg.y, msg.z, msg.id);
        g.world._suppressEdit = false;
        if (this.isHost) this._relay(conn.peer, msg);
        break;

      case 'pos':
        this.remote.updatePlayer(conn.peer, msg);
        if (this.isHost) this._relay(conn.peer, msg);
        break;

      case 'time':
        if (!this.isHost && g.sky) g.sky.time = msg.time;
        break;

      case 'mobs':
        if (!this.isHost) this.remote.updateMobs(msg.list);
        break;
    }
  }

  // L'hôte relaie un message à tous sauf l'émetteur (topologie en étoile).
  _relay(fromId, msg) {
    for (const [pid, c] of this.conns) if (pid !== fromId) c.send(msg);
  }

  _snapshot() {
    const g = this.game;
    return {
      t: 'snapshot',
      seed: g.world.generator.seed,
      mode: g.player.creative ? 'creative' : 'survival',
      edits: Array.from(g.world.edits.entries()),
      chests: Array.from(g.world.chests.entries()),
      time: g.sky.time,
    };
  }

  _applySnapshot(msg) {
    const g = this.game;
    g.loadWorld({ id: null, seed: msg.seed, mode: msg.mode, edits: msg.edits, chests: msg.chests, time: msg.time });
    g.world.onEdit = (x, y, z, bid) => this.broadcast({ t: 'block', x, y, z, id: bid });
    g.menu.setJoinInfo('Monde reçu — bon jeu !');
  }

  broadcast(msg) {
    for (const c of this.conns.values()) { try { c.send(msg); } catch (e) { /* ignore */ } }
  }

  // --- Boucle ---------------------------------------------------------------

  update(dt) {
    if (!this.peer) return;

    // Diffuse sa propre position régulièrement.
    this._posTimer += dt;
    if (this._posTimer > 0.08) {
      this._posTimer = 0;
      const p = this.game.player;
      this.broadcast({
        t: 'pos', x: p.position.x, y: p.position.y, z: p.position.z,
        yaw: p.yaw, pitch: p.pitch, item: this.game.inventory.selectedId(), moving: p.moving,
      });
    }

    // L'hôte diffuse l'heure et l'état des mobs.
    if (this.isHost) {
      this._timeTimer += dt;
      if (this._timeTimer > 2) { this._timeTimer = 0; this.broadcast({ t: 'time', time: this.game.sky.time }); }
      this._mobTimer += dt;
      if (this._mobTimer > 0.15) {
        this._mobTimer = 0;
        this.broadcast({
          t: 'mobs',
          list: this.game.mobManager.mobs.map((m, i) => ({
            k: i, type: m.type, x: m.position.x, y: m.position.y, z: m.position.z, yaw: m.yaw, moving: m.moving,
          })),
        });
      }
    }

    this.remote.update(dt);
  }

  dispose() {
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
    this.conns.clear();
    this.remote.clear();
    this.peer = null;
    if (this.game.world) this.game.world.onEdit = null;
  }
}
