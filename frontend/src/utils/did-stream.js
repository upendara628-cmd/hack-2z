import { API_BASE_URL } from '../config';

export class DIDStreamManager {
  constructor(videoElement, onStatusChange, onNewSubtitle) {
    this.videoElement = videoElement;
    this.onStatusChange = onStatusChange || (() => {});
    this.onNewSubtitle = onNewSubtitle || (() => {});

    this.peerConnection = null;
    this.streamId = null;
    this.sessionId = null;
    this.iceGatheringTimeout = null;
    this._streamConnected = false;
  }

  async connect() {
    this.onStatusChange('Connecting...');

    try {
      // 1. Create D-ID stream session
      const response = await fetch(`${API_BASE_URL}/api/did-stream/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned non-JSON (status ${response.status}): ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || !data.id) {
        throw new Error(data.error || 'Failed to create D-ID stream session');
      }

      this.streamId = data.id;
      this.sessionId = data.session_id;

      console.log('[D-ID] Stream session created:', this.streamId);

      // 2. Create RTCPeerConnection
      const iceServers = data.ice_servers || [{ urls: 'stun:stun.l.google.com:19302' }];
      this.peerConnection = new RTCPeerConnection({ iceServers });

      // ── Handle connection state changes ──────────────────────────
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('[D-ID] Connection state:', state);
        if (state === 'connected') {
          // Don't overwrite 'Connected' status — already set in ontrack
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          this.onStatusChange('Failed');
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log('[D-ID] ICE state:', state);
      };

      // ── Handle incoming media tracks ──────────────────────────────
      this.peerConnection.ontrack = (event) => {
        console.log('[D-ID] Track received:', event.track.kind, 'streams:', event.streams.length);

        // Attach the stream to the video element on FIRST track (video or audio)
        if (this.videoElement && event.streams && event.streams[0]) {
          // Always set srcObject to the full stream (contains both audio+video)
          if (!this._streamConnected) {
            this._streamConnected = true;
            this.videoElement.srcObject = event.streams[0];

            // Ensure the video plays (required for WebRTC streams)
            const playVideo = () => {
              if (!this.videoElement) return;
              this.videoElement.muted = true; // Keep muted to prevent duplicate voice
              this.videoElement.play()
                .then(() => {
                  console.log('[D-ID] ✅ Video is playing (muted)!');
                  this.onStatusChange('Connected');
                })
                .catch(err => {
                  if (err.name === 'AbortError') {
                    console.log('[D-ID] Play aborted by stream load. Retrying in 250ms...');
                    setTimeout(playVideo, 250);
                  } else {
                    console.error('[D-ID] Video play failed:', err);
                  }
                });
            };

            // Small delay to let the stream stabilize
            setTimeout(playVideo, 150);
          }
        }
      };

      // ── ICE Candidate exchange ────────────────────────────────────
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          const candidate = event.candidate.toJSON();
          fetch(`${API_BASE_URL}/api/did-stream/ice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stream_id: this.streamId,
              session_id: this.sessionId,
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            })
          }).catch(err => console.warn('[D-ID] ICE candidate send error:', err));
        }
      };

      // 3. Set Remote Description (D-ID's Offer SDP)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log('[D-ID] Remote description set');

      // 4. Create local Answer SDP
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('[D-ID] Local answer set');

      // 5. Send Answer to D-ID backend
      const sdpResponse = await fetch(`${API_BASE_URL}/api/did-stream/sdp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: this.streamId,
          session_id: this.sessionId,
          answer: answer
        })
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        let sdpData;
        try { sdpData = JSON.parse(text); } catch { sdpData = { error: text }; }
        throw new Error(sdpData.error || `SDP submission failed: ${sdpResponse.status}`);
      }

      this.onStatusChange('Waiting for avatar...');
      console.log('[D-ID] SDP answer sent. Waiting for video track...');

    } catch (error) {
      console.error('[D-ID] Connection failed:', error);
      this.onStatusChange('Failed');
      throw error;
    }
  }

  async talk(text) {
    if (!this.streamId || !this.sessionId) {
      throw new Error('No active D-ID stream session');
    }

    const response = await fetch(`${API_BASE_URL}/api/did-stream/talk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream_id: this.streamId,
        session_id: this.sessionId,
        text: text
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch { data = { error: responseText }; }
      throw new Error(data.error || `Talk request failed: ${response.status}`);
    }

    try {
      return await response.json();
    } catch {
      return { success: true };
    }
  }

  async destroy() {
    if (this.iceGatheringTimeout) clearTimeout(this.iceGatheringTimeout);

    if (this.streamId && this.sessionId) {
      try {
        await fetch(`${API_BASE_URL}/api/did-stream/destroy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stream_id: this.streamId,
            session_id: this.sessionId
          })
        });
      } catch (err) {
        console.warn('[D-ID] Destroy error:', err);
      }
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.streamId = null;
    this.sessionId = null;
    this._streamConnected = false;
    this.onStatusChange('Disconnected');
  }
}
