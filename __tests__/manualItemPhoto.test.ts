import {createRemoteItem} from '../src/services/supabaseData';
import {supabase} from '../src/lib/supabase';
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:jest.fn()},storage:{from:jest.fn()},from:jest.fn()}}));
const upload=jest.fn(),insert=jest.fn();const fetchMock=jest.fn();const originalFetch=globalThis.fetch;
beforeEach(()=>{
 jest.clearAllMocks();globalThis.fetch=fetchMock;
 jest.mocked(supabase.auth.getUser).mockResolvedValue({data:{user:{id:'owner'}},error:null} as any);
 jest.mocked(supabase.storage.from).mockReturnValue({upload} as any);
 jest.mocked(supabase.from).mockReturnValue({insert} as any);
 upload.mockResolvedValue({error:null});insert.mockResolvedValue({error:null});
 fetchMock.mockResolvedValue({ok:true,arrayBuffer:async()=>new Uint8Array([255,216,255]).buffer});
});
afterAll(()=>{globalThis.fetch=originalFetch;});
test('manual photo reads actual URI and stores image under the owner items folder',async()=>{
 await createRemoteItem({name:'鉛筆',category:'文具',quantity:1,photoUri:'file:///camera/photo.jpg'});
 expect(fetchMock).toHaveBeenCalledWith('file:///camera/photo.jpg');
 expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^owner\/items\/.*\.jpg$/),expect.any(ArrayBuffer),{contentType:'image/jpeg',upsert:false});
 expect(insert).toHaveBeenCalledWith(expect.objectContaining({image_path:upload.mock.calls[0][0],source:'manual'}));
});
test('failed upload never inserts an item without its chosen photo and retry succeeds',async()=>{
 upload.mockResolvedValueOnce({error:{message:'upload failed'}});
 const input={name:'鉛筆',category:'文具',quantity:1,photoUri:'blob:photo'};
 await expect(createRemoteItem(input)).rejects.toThrow('upload failed');expect(insert).not.toHaveBeenCalled();
 await createRemoteItem(input);expect(insert).toHaveBeenCalledTimes(1);
});
test('an optional photo can still be omitted',async()=>{
 await createRemoteItem({name:'鉛筆',category:'文具',quantity:1});
 expect(upload).not.toHaveBeenCalled();expect(insert).toHaveBeenCalledWith(expect.objectContaining({image_path:null}));
});

