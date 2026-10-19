import { VOICE } from './config/balance.js';
import { getCommand } from './data/commands.js';
import { AudioManager } from './systems/AudioManager.js';
import { EventBus, EVENTS } from './systems/EventBus.js';
import { GameState } from './systems/GameState.js';
import { VoiceCommandManager } from './systems/VoiceCommandManager.js';
import { HudView } from './ui/HudView.js';
import { Screens } from './ui/Screens.js';

const LANG_KEY = 'termopilas.voiceLang';
const readLang = () => {
  try {
    return localStorage.getItem(LANG_KEY) ?? VOICE.lang;
  } catch {
    return VOICE.lang;
  }
};

/**
 * Composición de la aplicación: estado, bus de eventos, voz, audio y vistas
 * HTML. Las escenas de Phaser la obtienen del registro (`registry.get('app')`).
 */
export function createApp() {
  const bus = new EventBus();
  const state = new GameState();
  const audio = new AudioManager();
  const hud = new HudView(document);
  const appEl = document.getElementById('app');

  const app = {
    bus,
    state,
    audio,
    hud,
    game: null,
    sim: null,
    lang: readLang(),
    probing: false, // comprobación del permiso desde el menú

    get inBattle() {
      return state.currentScene === 'BattleScene' && state.phase === 'playing';
    },

    setScene(name) {
      state.currentScene = name;
      appEl.dataset.scene = name;
    },

    // ── Navegación ────────────────────────────────────────────────────────
    enterMenu() {
      this.setScene('MenuScene');
      state.phase = 'idle';
      hud.show(false);
      voice.stop();
      this.renderMenu();
    },

    renderMenu(note, noteKind) {
      const prev = screens.lastMenu ?? {};
      screens.menu({
        voiceWanted: state.voiceEnabled,
        voiceSupported: voice.supported,
        lang: this.lang,
        note: note ?? prev.note ?? (voice.supported ? '' : 'Este navegador no ofrece reconocimiento de voz (prueba Chrome o Edge). La beta se juega igual con teclado y botones.'),
        noteKind: noteKind ?? prev.noteKind ?? (voice.supported ? '' : 'warn'),
      });
    },

    startBattle() {
      audio.unlock();
      screens.hide();
      const scenes = this.game.scene;
      for (const key of ['MenuScene', 'ResultScene', 'HUDScene', 'BattleScene']) {
        if (scenes.isActive(key) || scenes.isPaused(key)) scenes.stop(key);
      }
      scenes.start('BattleScene');
    },

    /** Llamado por BattleScene al crear la partida. */
    onBattleStarted() {
      this.setScene('BattleScene');
      hud.clearAlerts();
      hud.show(true);
      hud.el.lastCommand.textContent = 'Última orden: —';
      if (state.voiceEnabled) voice.start();
      else hud.voiceStatus(voice.status, voice.message, false);
    },

    showResult(result) {
      voice.stop();
      this.setScene('ResultScene');
      hud.show(false);
      audio.play(result.victory ? 'victory' : 'defeat');
      screens.result(result, state.stats);
    },

    goToMenu() {
      const scenes = this.game.scene;
      for (const key of ['BattleScene', 'HUDScene', 'ResultScene']) {
        if (scenes.isActive(key) || scenes.isPaused(key)) scenes.stop(key);
      }
      scenes.start('MenuScene');
    },

    // ── Órdenes ───────────────────────────────────────────────────────────
    sendCommand(id, source, transcript) {
      audio.unlock();
      if (!this.inBattle) return;
      bus.emit(EVENTS.COMMAND_RECEIVED, { id, source, transcript });
    },

    togglePause(source) {
      if (!this.inBattle) return;
      this.sendCommand(state.isPaused ? 'RESUME' : 'PAUSE', source);
    },

    // ── Voz ───────────────────────────────────────────────────────────────
    toggleVoice() {
      audio.unlock();
      if (!voice.supported) {
        const msg = 'Este navegador no ofrece reconocimiento de voz. Usa teclado y botones.';
        if (state.currentScene === 'MenuScene') this.renderMenu(msg, 'warn');
        else hud.alert(msg, 'warn', 2500);
        return;
      }
      if (state.currentScene === 'MenuScene') {
        if (state.voiceEnabled) {
          state.voiceEnabled = false;
          voice.stop();
          this.renderMenu('Micrófono desactivado.', '');
        } else {
          // Se pide el permiso ahora (acción explícita); solo escuchará durante la batalla.
          state.voiceEnabled = true;
          this.probing = true;
          this.renderMenu('Solicitando permiso del micrófono…', '');
          voice.start();
        }
        return;
      }
      if (voice.wanted) {
        state.voiceEnabled = false;
        voice.stop();
        hud.alert('Micrófono desactivado', 'info', 1400);
      } else {
        state.voiceEnabled = true;
        voice.start();
      }
    },

    setLanguage(lang) {
      this.lang = lang;
      voice.setLanguage(lang);
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch { /* almacenamiento no disponible: solo afecta a esta sesión */ }
    },
  };

  const voice = new VoiceCommandManager({
    lang: app.lang,
    onCommand: (id, { transcript }) => {
      if (!app.inBattle) return;
      app.sendCommand(id, 'voice', transcript);
    },
    onHeard: (e) => {
      if (!app.inBattle) return;
      if (e.status !== 'matched') {
        audio.play('reject');
        hud.voiceHeard(e);
      }
    },
    onStatus: (status, message) => {
      hud.voiceStatus(status, message, voice.wanted);
      state.voiceEnabled = state.voiceEnabled && status !== 'error' && status !== 'unsupported';
      if (status === 'error') bus.emit(EVENTS.VOICE_ERROR, { message });
      if (state.currentScene === 'MenuScene' && app.probing) {
        if (status === 'listening') {
          app.probing = false;
          voice.stop();
          app.renderMenu('Micrófono permitido. Escuchará solo durante la batalla.', 'ok');
        } else if (status === 'error') {
          app.probing = false;
          app.renderMenu(message, 'warn');
        }
      } else if (status === 'error' && app.inBattle) {
        hud.alert(`${message} Los botones y el teclado siguen activos.`, 'warn', 4000);
      }
    },
  });
  app.voice = voice;

  const screens = new Screens(document.getElementById('screen'), {
    onStart: () => app.startBattle(),
    onVoiceToggle: () => app.toggleVoice(),
    onLang: (lang) => app.setLanguage(lang),
    onResume: () => app.sendCommand('RESUME', 'button'),
    onRestart: () => app.startBattle(),
    onMenu: () => app.goToMenu(),
  });
  app.screens = screens;

  // Confirmación de cada orden en el HUD (último comando, aviso y sonido).
  bus.on(EVENTS.COMMAND_RESULT, (r) => {
    hud.commandResult(r);
    const def = getCommand(r.id);
    if (r.status === 'rejected') {
      audio.play('reject');
      hud.alert(r.message, 'warn', 1600, { icon: def?.icon });
    } else if (def?.tactical) {
      audio.play('accept');
      hud.alert(r.message, r.status === 'pending' ? 'info' : 'ok', 1200, { icon: def.icon });
    }
  });

  bus.on(EVENTS.PAUSE_CHANGED, ({ paused }) => {
    const scenes = app.game.scene;
    if (paused) {
      scenes.pause('BattleScene');
      scenes.pause('HUDScene');
      screens.pause();
    } else {
      scenes.resume('BattleScene');
      scenes.resume('HUDScene');
      screens.hide();
    }
  });

  hud.voiceStatus(voice.status, voice.message, false);
  return app;
}
