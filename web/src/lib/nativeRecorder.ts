import { registerPlugin } from '@capacitor/core';

// Hand-written custom native plugin (mobile/android/.../recorder/), not an
// installed package: no drop-in Capacitor audio recorder plugin actually
// implements a real Android foreground service, which is the one thing that
// has to be reliable here (recording must survive the app backgrounding or
// the screen locking). See RecorderService.java for the actual mechanism.
export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface StartRecordingOptions {
	bitRate?: number;
	sampleRate?: number;
}

export interface StopRecordingResult {
	uri: string;
	duration: number;
}

export interface RecordingStatusResult {
	status: 'INACTIVE' | 'RECORDING' | 'PAUSED';
}

export interface AmplitudeResult {
	value: number;
}

export interface PermissionResult {
	recordAudio: PermissionState;
}

export interface RecoralRecorderPlugin {
	startRecording(options?: StartRecordingOptions): Promise<void>;
	pauseRecording(): Promise<void>;
	resumeRecording(): Promise<void>;
	stopRecording(): Promise<StopRecordingResult>;
	cancelRecording(): Promise<void>;
	getRecordingStatus(): Promise<RecordingStatusResult>;
	getCurrentAmplitude(): Promise<AmplitudeResult>;
	checkPermissions(): Promise<PermissionResult>;
	requestPermissions(): Promise<PermissionResult>;
}

export const RecoralRecorder = registerPlugin<RecoralRecorderPlugin>('RecoralRecorder');
