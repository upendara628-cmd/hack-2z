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
  }

  async connect() {
    this.onStatusChange('Connecting to D-ID Session...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/did-stream/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned non-JSON response (status ${response.status}): ${responseText.substring(0, 200)}`);
      }
      
      if (!response.ok || !data.id) {
        throw new Error(data.error || 'Failed to create stream session');
      }
      
      this.streamId = data.id;
      this.sessionId = data.session_id;
      
      // 2. Create RTCPeerConnection with D-ID's ICE Servers
      const iceServers = data.ice_servers;
      this.peerConnection = new RTCPeerConnection({ iceServers });
      
      // Handle connection states
      this.peerConnection.onconnectionstatechange = () => {
        this.onStatusChange(`Connection state: ${this.peerConnection.connectionState}`);
      };
      
      // Handle incoming video track
      this.peerConnection.ontrack = (event) => {
        if (event.track.kind === 'video' && this.videoElement) {
          this.videoElement.srcObject = event.streams[0];
          this.onStatusChange('Connected');
        }
      };

      // Handle ICE Candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
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
          }).catch(err => console.error("Error sending ICE Candidate to D-ID:", err));
        }
      };

      // 3. Set Remote Description (D-ID's Offer)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // 4. Create Local Answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // 5. Send Answer to D-ID
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
        const sdpText = await sdpResponse.text();
        let sdpData;
        try {
          sdpData = JSON.parse(sdpText);
        } catch (e) {
          throw new Error(`SDP submission failed (status ${sdpResponse.status}): ${sdpText.substring(0, 200)}`);
        }
        throw new Error(sdpData.error || 'Failed to submit SDP Answer');
      }
      
      this.onStatusChange('WebRTC Negotiated. Waiting for stream...');
    } catch (error) {
      console.error("D-ID Connection failed:", error);
      this.onStatusChange('Failed');
      throw error;
    }
  }

  async talk(text) {
    if (!this.streamId || !this.sessionId) {
      throw new Error("No active D-ID stream session");
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
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Talk request failed (status ${response.status}): ${responseText.substring(0, 200)}`);
      }
      throw new Error(data.error || 'Talk request failed');
    }
    
    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch (e) {
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
        console.error("Error destroying D-ID stream session:", err);
      }
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.streamId = null;
    this.sessionId = null;
    this.onStatusChange('Disconnected');
  }
}
