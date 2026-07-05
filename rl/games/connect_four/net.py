"""
Dual-head neural network for Connect Four (AlphaZero-style).

Architecture:
  Input: (batch, 3, 6, 7) float32 tensor
  Backbone: 4 residual convolutional blocks (64 channels, 3x3 kernel)
  Policy head: → softmax over 7 columns
  Value head: → tanh scalar in [-1, +1]
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

from rl.core.interfaces import BaseNet

class ResidualBlock(nn.Module):
    """Standard pre-activation residual block."""

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + residual)


class ConnectFourNet(nn.Module, BaseNet):
    """
    AlphaZero-style dual-head network for Connect Four.

    Policy head output: log-probabilities over 7 columns (use with NLLLoss or convert to probs).
    Value head output: scalar in [-1, +1] representing expected outcome for the current player.
    """

    NUM_ACTIONS = 7   # one per column
    INPUT_PLANES = 3  # self, opponent, constant
    ROWS = 6
    COLS = 7

    def __init__(self, num_res_blocks: int = 4, num_channels: int = 64) -> None:
        super().__init__()

        # Input conv
        self.input_conv = nn.Sequential(
            nn.Conv2d(self.INPUT_PLANES, num_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(num_channels),
            nn.ReLU(),
        )

        # Residual tower
        self.res_blocks = nn.Sequential(*[ResidualBlock(num_channels) for _ in range(num_res_blocks)])

        # Policy head
        self.policy_conv = nn.Sequential(
            nn.Conv2d(num_channels, 32, kernel_size=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(),
        )
        self.policy_fc = nn.Linear(32 * self.ROWS * self.COLS, self.NUM_ACTIONS)

        # Value head
        self.value_conv = nn.Sequential(
            nn.Conv2d(num_channels, 32, kernel_size=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(),
        )
        self.value_fc = nn.Sequential(
            nn.Linear(32 * self.ROWS * self.COLS, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Tanh(),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (batch, 3, 6, 7) float32 tensor

        Returns:
            policy_logits: (batch, 7) — raw log-probabilities (before softmax)
            value: (batch, 1) — value in [-1, +1]
        """
        out = self.input_conv(x)
        out = self.res_blocks(out)

        # Policy head
        p = self.policy_conv(out)
        p = p.reshape(p.size(0), -1)
        policy_logits = self.policy_fc(p)

        # Value head
        v = self.value_conv(out)
        v = v.reshape(v.size(0), -1)
        value = self.value_fc(v)

        return policy_logits, value

    def predict(self, encoded_state: torch.Tensor | np.ndarray) -> tuple[np.ndarray, float]:
        """
        Single-state inference (no gradient).

        Args:
            encoded_state: (3, 6, 7) float32 tensor or numpy array

        Returns:
            policy_probs: (7,) array of probabilities
            value: scalar float
        """
        self.eval()
        with torch.no_grad():
            if not isinstance(encoded_state, torch.Tensor):
                encoded_state = torch.tensor(encoded_state, dtype=torch.float32)
            
            device = next(self.parameters()).device
            x = encoded_state.unsqueeze(0).to(device)  # add batch dim
            logits, v = self(x)
            probs = torch.softmax(logits.squeeze(0), dim=0)
            return probs.cpu().numpy(), v.item()

    def predict_batch(self, state_tensors: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
        if not state_tensors:
            return np.array([]), np.array([])
            
        self.eval()
        with torch.no_grad():
            device = next(self.parameters()).device
            x = torch.tensor(np.stack(state_tensors), dtype=torch.float32, device=device)
            logits, v = self(x)
            probs = torch.softmax(logits, dim=1)
            return probs.cpu().numpy(), v.squeeze(1).cpu().numpy()


def get_device() -> torch.device:
    """Select the best available device: MPS (Apple Silicon) > CUDA > CPU."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def create_net(device: torch.device | None = None) -> ConnectFourNet:
    """Create a new randomly initialized network on the best available device."""
    if device is None:
        device = get_device()
    net = ConnectFourNet()
    net.to(device)
    return net


def save_checkpoint(net: ConnectFourNet, path: str) -> None:
    torch.save(net.state_dict(), path)


def load_checkpoint(path: str, device: torch.device | None = None) -> ConnectFourNet:
    if device is None:
        device = get_device()
    net = ConnectFourNet()
    net.load_state_dict(torch.load(path, map_location=device))
    net.to(device)
    net.eval()
    return net
