# Lotline — ready-to-narrate demo

The supplied **lotline-silent-demo.mp4** is a real three-minute screen recording of the tested application. It has no voice track. All stock, clinics, notices and physical actions shown are fictional.

## Record your voice

1. Open the video in a player and the **../submission/lotline-recording-guide.pdf** beside it.
2. Read **../submission/demo-script-3min.md** word for word. Spoken sections start at 0:00, 0:25, 0:50, 1:20, 2:05 and 2:35. Leave natural pauses while the UI actions occur.
3. Record in a quiet room with a phone or microphone. Start the narration at video time zero. Save your voice as WAV or M4A.
4. Add the voice recording to the video in your usual editor. Import **../submission/lotline-demo-captions.srt** and adjust cue times to your actual narration. Do not speed through the verification/evidence sequence.
5. Export 1080p or the source resolution, H.264 MP4. Listen to the complete exported file before uploading to YouTube or Vimeo. Devpost’s embedded video field accepts those hosted URLs.

No video is required by the currently published preliminary-round requirements; it is supporting material. The official-template PDF remains the required submission artifact.

## Optional local combination with FFmpeg

Run from this directory, replacing the voice filename with your recording. This preserves the screen video and pads the voice track to exactly three minutes:

```sh
ffmpeg -i lotline-silent-demo.mp4 -i voiceover.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -af apad -t 180 -movflags +faststart lotline-narrated-demo.mp4
```

Do not run the command against the only copy of your original recording. If the narration runs beyond three minutes, edit its timing before using the fixed-duration command.

**demo-evidence.json** is the matching synthetic completed response exported during this recording, with 76 units accounted for. It is not an actual recall response.
