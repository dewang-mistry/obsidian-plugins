import { requestUrl } from "obsidian";

export interface TTSEngine {
	speak(text: string): Promise<void>;
	cancel(): void;
	isSpeaking(): boolean;
}

// ── Web Speech API (built-in, no API key needed) ──

export class WebSpeechEngine implements TTSEngine {
	private rate: number;
	private speaking = false;

	constructor(rate = 1.0) {
		this.rate = rate;
	}

	setRate(rate: number) {
		this.rate = rate;
	}

	speak(text: string): Promise<void> {
		return new Promise((resolve) => {
			this.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = this.rate;
			utterance.onend = () => {
				this.speaking = false;
				resolve();
			};
			utterance.onerror = () => {
				this.speaking = false;
				resolve();
			};
			this.speaking = true;
			window.speechSynthesis.speak(utterance);
		});
	}

	cancel(): void {
		window.speechSynthesis.cancel();
		this.speaking = false;
	}

	isSpeaking(): boolean {
		return this.speaking;
	}
}

// ── ElevenLabs API ──

export class ElevenLabsEngine implements TTSEngine {
	private apiKey: string;
	private voiceId: string;
	private rate: number;
	private audioContext: AudioContext | null = null;
	private sourceNode: AudioBufferSourceNode | null = null;
	private speaking = false;

	constructor(apiKey: string, voiceId = "21m00Tcm4TlvDq8ikWAM", rate = 1.0) {
		this.apiKey = apiKey;
		this.voiceId = voiceId;
		this.rate = rate;
	}

	setApiKey(apiKey: string) {
		this.apiKey = apiKey;
	}

	setVoiceId(voiceId: string) {
		this.voiceId = voiceId;
	}

	setRate(rate: number) {
		this.rate = rate;
	}

	async speak(text: string): Promise<void> {
		this.cancel();

		try {
			const response = await requestUrl({
				url: `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
				method: "POST",
				headers: {
					"xi-api-key": this.apiKey,
					"Content-Type": "application/json",
					Accept: "audio/mpeg",
				},
				body: JSON.stringify({
					text,
					model_id: "eleven_monolingual_v1",
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.75,
					},
				}),
			});

			if (!this.audioContext) {
				this.audioContext = new AudioContext();
			}

			const audioBuffer = await this.audioContext.decodeAudioData(
				response.arrayBuffer.slice(0)
			);

			this.sourceNode = this.audioContext.createBufferSource();
			this.sourceNode.buffer = audioBuffer;
			this.sourceNode.playbackRate.value = this.rate;
			this.sourceNode.connect(this.audioContext.destination);

			this.speaking = true;
			this.sourceNode.onended = () => {
				this.speaking = false;
				this.sourceNode = null;
			};
			this.sourceNode.start();
		} catch (e) {
			console.error("ElevenLabs TTS error:", e);
			this.speaking = false;
		}
	}

	cancel(): void {
		if (this.sourceNode) {
			try {
				this.sourceNode.stop();
			} catch {
				// already stopped
			}
			this.sourceNode = null;
		}
		this.speaking = false;
	}

	isSpeaking(): boolean {
		return this.speaking;
	}
}

// ── Factory ──

export function createTTSEngine(
	apiKey: string | undefined,
	voiceId: string | undefined,
	rate: number
): TTSEngine {
	if (apiKey && apiKey.trim().length > 0) {
		return new ElevenLabsEngine(apiKey, voiceId || undefined, rate);
	}
	return new WebSpeechEngine(rate);
}
