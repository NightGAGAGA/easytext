import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  IconButton,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import { Delete, AccessTime } from '@mui/icons-material';
import { RecentDocument } from '../../store/store';

interface RecentDocumentsDialogProps {
  open: boolean;
  onClose: () => void;
  documents: RecentDocument[];
  onOpen: (doc: RecentDocument) => void;
  onDelete: (fileName: string) => void;
}

export const RecentDocumentsDialog: React.FC<RecentDocumentsDialogProps> = ({
  open,
  onClose,
  documents,
  onOpen,
  onDelete,
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
        最近编辑
      </DialogTitle>
      <DialogContent>
        {documents.length === 0 ? (
          <Typography sx={{ fontSize: '1.2rem', py: 4, textAlign: 'center', color: '#9e9e9e' }}>
            暂无最近编辑的文档
          </Typography>
        ) : (
          <List>
            {documents.map((doc, index) => (
              <React.Fragment key={doc.fileName + doc.timestamp}>
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 1,
                    py: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      gap: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        flex: 1,
                        cursor: 'pointer',
                        '&:hover': { color: '#616161' },
                      }}
                      onClick={() => onOpen(doc)}
                    >
                      {doc.fileName}
                    </Typography>
                    <IconButton
                      onClick={() => onDelete(doc.fileName)}
                      sx={{ color: '#e57373' }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 0 }}>
                    <AccessTime sx={{ fontSize: 16, color: '#9e9e9e' }} />
                    <Typography sx={{ fontSize: '0.9rem', color: '#9e9e9e' }}>
                      {formatTime(doc.timestamp)}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 1, width: '100%' }}>
                    <Typography
                      sx={{
                        fontSize: '0.95rem',
                        color: '#616161',
                        lineHeight: 1.6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {doc.content.replace(/<[^>]+>/g, '').slice(0, 100)}
                      {doc.content.length > 100 ? '...' : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, width: '100%' }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => onOpen(doc)}
                      sx={{ fontSize: '1rem', minHeight: 44, flex: 1, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
                    >
                      打开
                    </Button>
                  </Box>
                </ListItem>
                {index < documents.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          variant="contained"
          size="large"
          fullWidth
          sx={{ fontSize: '1.05rem', minHeight: 48, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
        >
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};